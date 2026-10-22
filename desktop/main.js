const { app, BrowserWindow, screen, ipcMain, dialog, shell, desktopCapturer, session } = require('electron');
const { pathToFileURL } = require('url');
const { parsePptx } = require('./pptx');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { WebSocketServer } = require('ws');

const { RecordingStore } = require('./recording-store');
const recordingStore = new RecordingStore();
const {StreamingEngine,probeFFmpeg}=require('./streaming-engine');
const streamingEngine=new StreamingEngine(status=>{if(operator&&!operator.isDestroyed()){try{operator.webContents.send('streamStatus',status);}catch{}}});
let ffmpegExecutable='ffmpeg';
let streamingStarting=false;
let recordingDialogOpen = false;

const PORT = 8787;
const PIN = String(Math.floor(1000 + Math.random() * 9000));
let operator, output, stage;
let outputMode = 'projection';
let selectedCapture=null;
let state = { liveText: '', avatar: false, next: '', library: [] };
const clients = new Set(); // authenticated phone remotes

function lanIp() {
  for (const list of Object.values(os.networkInterfaces()))
    for (const n of list) if (n.family === 'IPv4' && !n.internal) return n.address;
  return '127.0.0.1';
}

function makeWindow(file, display, windowed) {
  const b = display.bounds;
  const w = new BrowserWindow({
    x: b.x + (windowed ? 40 : 0), y: b.y + (windowed ? 40 : 0),
    width: windowed ? 960 : b.width, height: windowed ? 540 : b.height,
    fullscreen: !windowed, frame: windowed, backgroundColor: '#000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  w.loadFile(path.join(__dirname, 'renderer', file));
  return w;
}

function broadcast() {
  for (const w of [output, stage]) if (w && !w.isDestroyed()) w.webContents.send('state', state);
  const msg = JSON.stringify({ type: 'state', state });
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{
    const selected=selectedCapture;selectedCapture=null;
    if(!operator||request.frame!==operator.webContents.mainFrame||!selected||Date.now()>selected.expires){callback({});return;}
    try{const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});const source=sources.find(s=>s.id===selected.id);callback(source?{video:source}:{});}catch{callback({});}
  });
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const external = displays.filter(d => d.id !== primary.id);
  operator = new BrowserWindow({
    width: 1400, height: 860,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  operator.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // 2nd display = projector, 3rd = stage. With fewer screens, open windowed so you can test.
  output = makeWindow('output.html', external[0] || primary, !external[0]);
  stage = makeWindow('stage.html', external[1] || external[0] || primary, !external[1]);
  operator.on('close', event => {
    if (recordingStore.active || recordingDialogOpen || streamingEngine.active || streamingStarting) { event.preventDefault(); operator.webContents.send('recordingCloseRequested'); }
  });
  operator.webContents.on('render-process-gone',()=>{
    if(recordingStore.active)recordingStore.abort(recordingStore.active.id).catch(console.error);
    if(streamingEngine.active)streamingEngine.stop(streamingEngine.active.id).catch(console.error);
  });
  operator.on('closed', () => app.quit());
  output.webContents.once('did-finish-load', broadcast);
  stage.webContents.once('did-finish-load', broadcast);
});

ipcMain.on('publish', (e, s) => { if (e.sender !== operator?.webContents) return; state = s; operator.webContents.send('projectionState',{liveText:state.liveText||''}); broadcast(); });
ipcMain.handle('info', () => ({ ip: lanIp(), port: PORT, pin: PIN }));
ipcMain.handle('openExternal', async (_e, rawUrl) => {
  const u = new URL(String(rawUrl));
  if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Only web links are allowed.');
  await shell.openExternal(u.toString()); return true;
});

ipcMain.handle('exportProject', async (_e, payload) => {
  const r = await dialog.showSaveDialog(operator, {
    title: 'Export GEN3D Studio project', defaultPath: 'gen3d-presentation.json',
    filters: [{ name: 'GEN3D Project', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return { canceled: true };
  const project = { format: 'gen3d-studio-project', version: 1, exportedAt: new Date().toISOString(), ...payload };
  await fs.writeFile(r.filePath, JSON.stringify(project, null, 2), 'utf8');
  return { canceled: false, filePath: r.filePath };
});

ipcMain.handle('importProject', async () => {
  const r = await dialog.showOpenDialog(operator, {
    title: 'Import GEN3D Studio project', properties: ['openFile'],
    filters: [{ name: 'GEN3D Project', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const project = JSON.parse(await fs.readFile(r.filePaths[0], 'utf8'));
  if (project.format !== 'gen3d-studio-project' || !Array.isArray(project.songs))
    throw new Error('This is not a valid GEN3D Studio project file.');
  return project;
});

ipcMain.handle('importPptx', async () => {
  const r = await dialog.showOpenDialog(operator, { properties: ['openFile'], filters: [{ name: 'PowerPoint', extensions: ['pptx'] }] });
  if (r.canceled) return null;
  const f = r.filePaths[0];
  return { title: path.basename(f, path.extname(f)), slides: await parsePptx(f) };
});
ipcMain.handle('pickMedia', async () => {
  const r = await dialog.showOpenDialog(operator, { properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images, video and audio', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a'] }] });
  if (r.canceled) return [];
  return r.filePaths.map(f => ({ name: path.basename(f), url: pathToFileURL(f).href,
    type: /\.(mp4|webm|mov)$/i.test(f) ? 'video' : /\.(mp3|wav|ogg|m4a)$/i.test(f) ? 'audio' : 'image' }));
});

// Remote control server for the Expo phone app
const wss = new WebSocketServer({ port: PORT });
wss.on('connection', ws => {
  let authed = false;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!authed) {
      if (m.type === 'hello' && m.pin === PIN) {
        authed = true; clients.add(ws);
        ws.send(JSON.stringify({ type: 'state', state }));
      } else ws.close();
      return;
    }
    if (m.type === 'cmd' && operator && !operator.isDestroyed())
      operator.webContents.send('command', m);
  });
  ws.on('close', () => clients.delete(ws));
});

// Program video and mixed audio output: relay signaling between the React operator and projector.
// The compositor's MediaStream stays in WebRTC, rather than IPC image buffers.
ipcMain.on('videoSignal', (event, message) => {
  if (!message || !['ready','offer','answer','candidate'].includes(message.type)) return;
  if (event.sender === operator?.webContents && event.senderFrame === operator.webContents.mainFrame) {
    if (output && !output.isDestroyed()) output.webContents.send('videoSignal', message);
  } else if (event.sender === output?.webContents) {
    if (message.type === 'ready') output.webContents.send('outputMode', outputMode);
    if (operator && !operator.isDestroyed()) operator.webContents.send('videoSignal', message);
  }
});
ipcMain.on('requestVideoOutput', event => {
  if (event.sender !== operator?.webContents || event.senderFrame !== operator.webContents.mainFrame) return;
  if (!output || output.isDestroyed()) {
    const primary=screen.getPrimaryDisplay();
    const external=screen.getAllDisplays().filter(d=>d.id!==primary.id);
    output=makeWindow('output.html',external[0]||primary,!external[0]);
    output.webContents.once('did-finish-load',broadcast);
    return;
  }
  if (output && !output.isDestroyed()) {
    operator.webContents.send('videoSignal', {type:'ready'});
    operator.webContents.send('outputMode', outputMode);
    output.webContents.send('outputMode', outputMode);
  }
});
ipcMain.on('setOutputMode', (event, mode) => {
  if (event.sender !== operator?.webContents || event.senderFrame !== operator.webContents.mainFrame) return;
  if (!['projection','production'].includes(mode)) return;
  outputMode = mode;
  operator.webContents.send('outputMode', mode);
  if (output && !output.isDestroyed()) output.webContents.send('outputMode', mode);
});

function requireOperator(event) {
  if(event.sender!==operator?.webContents || event.senderFrame!==operator.webContents.mainFrame)
    throw Error('Only the operator workspace can control Program outputs.');
}
ipcMain.handle('beginRecording', async event => {
  requireOperator(event);
  if(recordingStore.active || recordingDialogOpen) throw Error('Recording is already starting or running.');
  recordingDialogOpen=true;
  try {
    const result=await dialog.showSaveDialog(operator,{title:'Record GEN3D Program',defaultPath:`GEN3D-Program-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`,filters:[{name:'WebM video and audio',extensions:['webm']}]});
    if(result.canceled||!result.filePath||!operator||operator.isDestroyed())return {canceled:true};
    const filePath=result.filePath;
    if(!/\.webm$/i.test(filePath))throw Error('Use a filename ending in .webm.');
    return await recordingStore.begin(filePath);
  } finally {recordingDialogOpen=false;}
});
ipcMain.handle('writeRecording', async(event,payload)=>{requireOperator(event);return recordingStore.append(payload?.id,payload?.chunk);});
ipcMain.handle('finishRecording', async(event,id)=>{requireOperator(event);return recordingStore.finish(id);});
ipcMain.handle('abortRecording', async(event,id)=>{requireOperator(event);return recordingStore.abort(id);});
ipcMain.on('recordingReadyToClose',event=>{
  try {requireOperator(event);} catch {return;}
  if(!recordingStore.active&&!recordingDialogOpen&&!streamingEngine.active&&!streamingStarting)app.quit();
});
app.on('before-quit',event=>{
  if(recordingStore.active||recordingDialogOpen||streamingEngine.active||streamingStarting){event.preventDefault();if(operator&&!operator.isDestroyed())operator.webContents.send('recordingCloseRequested');}
});

ipcMain.handle('ffmpegInfo',async event=>{requireOperator(event);return probeFFmpeg(ffmpegExecutable);});
ipcMain.handle('chooseFFmpeg',async event=>{
  requireOperator(event);if(streamingEngine.active||streamingStarting)throw Error('Stop streaming before changing the encoder.');
  const result=await dialog.showOpenDialog(operator,{title:'Choose FFmpeg executable',properties:['openFile'],filters:process.platform==='win32'?[{name:'FFmpeg executable',extensions:['exe']}]:[{name:'Executable',extensions:['*']}]});
  if(result.canceled||!result.filePaths[0])return {canceled:true};
  const info=await probeFFmpeg(result.filePaths[0]);ffmpegExecutable=result.filePaths[0];return info;
});
ipcMain.handle('startStream',async(event,config)=>{
  requireOperator(event);if(streamingEngine.active||streamingStarting)throw Error('Streaming is already starting or running.');streamingStarting=true;
  try{await probeFFmpeg(ffmpegExecutable);return await streamingEngine.start(config,ffmpegExecutable);}finally{streamingStarting=false;}
});
ipcMain.handle('writeStream',async(event,payload)=>{requireOperator(event);return streamingEngine.append(payload?.id,payload?.chunk);});
ipcMain.handle('stopStream',async(event,id)=>{requireOperator(event);return streamingEngine.stop(id);});

ipcMain.on('requestProjectionState',event=>{try{requireOperator(event);}catch{return;}operator.webContents.send('projectionState',{liveText:state.liveText||''});});
ipcMain.handle('listCaptureSources',async event=>{
  requireOperator(event);const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:320,height:180},fetchWindowIcons:false});
  return sources.map(source=>({id:source.id,name:source.name,thumbnail:source.thumbnail.toDataURL()}));
});
ipcMain.handle('selectCaptureSource',async(event,id)=>{requireOperator(event);if(typeof id!=='string'||id.length>200)throw Error('Invalid capture source.');selectedCapture={id,expires:Date.now()+10000};return true;});
ipcMain.handle('pickVisualMedia',async event=>{
  requireOperator(event);const result=await dialog.showOpenDialog(operator,{title:'Add visual production inputs',properties:['openFile','multiSelections'],filters:[{name:'Images and videos',extensions:['png','jpg','jpeg','webp','gif','mp4','webm','mov']}]});
  if(result.canceled)return [];
  return result.filePaths.map(file=>({name:path.basename(file),url:pathToFileURL(file).href,type:/\.(mp4|webm|mov)$/i.test(file)?'video':'image'}));
});
ipcMain.handle('pickLogo',async event=>{
  requireOperator(event);const result=await dialog.showOpenDialog(operator,{title:'Choose Program logo',properties:['openFile'],filters:[{name:'Logo image',extensions:['png','jpg','jpeg','webp']}]});
  if(result.canceled||!result.filePaths[0])return null;const file=result.filePaths[0];return {name:path.basename(file),url:pathToFileURL(file).href,type:'image'};
});
