const { app, BrowserWindow, screen, ipcMain, dialog, shell, desktopCapturer, session } = require('electron');
const { pathToFileURL } = require('url');
const { parsePptx } = require('./pptx');
const {VisualDecks}=require('./visual-decks');
let visualDecks;
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const {NetworkInputs}=require('./network-inputs');
const {BrowserInputs}=require('./browser-inputs');
const networkInputs=new NetworkInputs();
const {NdiInputs}=require('./ndi-inputs');
const ndiInputs=new NdiInputs();
const browserInputs=new BrowserInputs(BrowserWindow,frame=>{if(operator&&!operator.isDestroyed())operator.webContents.send('browserInputFrame',frame);},id=>{if(operator&&!operator.isDestroyed())operator.webContents.send('browserInputEnded',id);});
const { createRemoteServer } = require('./remote-server');

const {HolyricsImport}=require('./holyrics-import');
const holyricsImport=new HolyricsImport();
const {cloudBackup}=require('./cloud-backup');
const {VirtualCamera}=require('./virtual-camera');
const virtualCamera=new VirtualCamera();
const {IsoStore}=require('./iso-store');
const isoStore=new IsoStore();let isoDialogOpen=false;
const { RecordingStore } = require('./recording-store');
const recordingStore = new RecordingStore();
const {StreamingEngine,probeFFmpeg}=require('./streaming-engine');
const streamingEngine=new StreamingEngine(status=>{if(operator&&!operator.isDestroyed()){try{operator.webContents.send('streamStatus',status);}catch{}}});
const bundledFFmpeg=app.isPackaged?path.join(process.resourcesPath,'ffmpeg','ffmpeg.exe'):path.join(__dirname,'vendor','ffmpeg','windows','ffmpeg.exe');
let ffmpegExecutable=process.platform==='win32'&&require('node:fs').existsSync(bundledFFmpeg)?bundledFFmpeg:'ffmpeg';
let streamingStarting=false;
let recordingDialogOpen = false;

const PORT = 8787;
const PIN = String(Math.floor(1000 + Math.random() * 9000));
let operator, output, stage, stageDisplays;
const {StageDisplays}=require('./stage-displays');
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
  for (const w of [output]) if (w && !w.isDestroyed()) w.webContents.send('state', state);
  stageDisplays?.broadcast();
  const msg = JSON.stringify({ type: 'state', state });
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{
    const selected=selectedCapture;selectedCapture=null;
    if(!operator||request.frame!==operator.webContents.mainFrame||!selected||Date.now()>selected.expires){callback({});return;}
    try{const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});const source=sources.find(s=>s.id===selected.id);callback(source?{video:source}:{});}catch{callback({});}
  });
  visualDecks=new VisualDecks(path.join(app.getPath('userData'),'visual-decks'),{nativeScript:app.isPackaged?path.join(process.resourcesPath,'native','powerpoint-export.ps1'):path.join(__dirname,'native','powerpoint-export.ps1')});
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
  stageDisplays=new StageDisplays({screen,makeWindow:display=>makeWindow('stage.html',display,true),file:path.join(app.getPath('userData'),'stage-displays.json'),getState:()=>state});
  stageDisplays.initialize(stage,external[1]||external[0]||primary);
  screen.on('display-removed',()=>{for(const entry of stageDisplays.entries.values())stageDisplays.position(entry);});
  operator.on('closed',()=>{stageDisplays?.dispose();void ndiInputs.dispose();browserInputs.dispose();void networkInputs.dispose();if(output&&!output.isDestroyed())output.destroy();if(stage&&!stage.isDestroyed())stage.destroy();});
  operator.on('close', event => {
    if (recordingStore.active || recordingDialogOpen || isoStore.stores.size || isoDialogOpen || streamingEngine.active || streamingStarting) { event.preventDefault(); operator.webContents.send('recordingCloseRequested'); }
  });
  operator.webContents.on('render-process-gone',()=>{
    browserInputs.dispose();void networkInputs.dispose();void isoStore.abortAll();
    if(recordingStore.active)recordingStore.abort(recordingStore.active.id).catch(console.error);
    if(streamingEngine.active)streamingEngine.stop(streamingEngine.active.id).catch(console.error);
  });
  operator.on('closed', () => app.quit());
  output.webContents.once('did-finish-load', broadcast);
  stage.webContents.once('did-finish-load', broadcast);
});

ipcMain.on('publish', (e, s) => { if (e.sender !== operator?.webContents) return; state = {...s,production:state.production}; operator.webContents.send('projectionState',{liveText:state.liveText||''}); broadcast(); });
ipcMain.handle('stageDisplays',event=>{requireStageOperator(event);return stageDisplays.list();});
ipcMain.handle('configureStageDisplay',(event,{action,config})=>{requireStageOperator(event);return stageDisplays.change(action,config);});
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

ipcMain.handle('readHolyricsSongs',(event,config)=>{requireStageOperator(event);return holyricsImport.read(config);});
ipcMain.handle('cancelHolyricsImport',event=>{requireStageOperator(event);holyricsImport.cancel();});
ipcMain.handle('importVisualPptx',async event=>{requireStageOperator(event);const result=await dialog.showOpenDialog(operator,{title:'Import visual PowerPoint deck',properties:['openFile'],filters:[{name:'PowerPoint',extensions:['pptx']}]});if(result.canceled||!result.filePaths[0])return null;return visualDecks.import(result.filePaths[0]);});
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

// Browser and Expo remotes share the existing PIN-authenticated control channel.
const remote = createRemoteServer({port:PORT,pin:PIN,clients,getState:()=>state,onCommand:message=>{
  if(operator&&!operator.isDestroyed())operator.webContents.send(message.cmd.startsWith('production')?'productionCommand':'command',message);
},onProgramSignal:(target,signal)=>{if(operator&&!operator.isDestroyed())operator.webContents.send('programSignal',{target,signal});}});
remote.server.on('error',error=>console.error('Phone remote unavailable:',error.message));


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

function requireStageOperator(event){
  const frame=event.senderFrame,main=operator?.webContents.mainFrame;
  const projection=frame?.parent===main&&frame.url===pathToFileURL(path.join(__dirname,'renderer','operator.html')).href;
  if(event.sender!==operator?.webContents||!(frame===main||projection))throw Error('Only the operator workspace can manage stage displays.');
}
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
  if(!recordingStore.active&&!recordingDialogOpen&&!isoStore.stores.size&&!isoDialogOpen&&!streamingEngine.active&&!streamingStarting)app.quit();
});
app.on('before-quit',event=>{
  if(recordingStore.active||recordingDialogOpen||isoStore.stores.size||isoDialogOpen||streamingEngine.active||streamingStarting){event.preventDefault();if(operator&&!operator.isDestroyed())operator.webContents.send('recordingCloseRequested');}
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

ipcMain.handle('discoverNdiSources',(event,ips)=>{requireOperator(event);return ndiInputs.discover(ips);});
ipcMain.handle('chooseNdiRuntime',async event=>{requireOperator(event);const selected=await dialog.showOpenDialog(operator,{title:'Choose installed NDI 6 runtime library',properties:['openFile'],filters:[{name:'NDI runtime',extensions:process.platform==='win32'?['dll']:['so','6','dylib']}]});if(selected.canceled||!selected.filePaths[0])return null;ndiInputs.setLibrary(selected.filePaths[0]);return ndiInputs.discover();});
ipcMain.handle('startNdiInput',async(event,id)=>{requireOperator(event);await probeFFmpeg(ffmpegExecutable);return ndiInputs.start(id,ffmpegExecutable);});
ipcMain.handle('stopNdiInput',(event,id)=>{requireOperator(event);return ndiInputs.stop(id);});
ipcMain.handle('startNetworkInput',async(event,url)=>{requireOperator(event);await probeFFmpeg(ffmpegExecutable);return networkInputs.start(url,ffmpegExecutable);});
ipcMain.handle('stopNetworkInput',async(event,id)=>{requireOperator(event);return networkInputs.stop(id);});
ipcMain.handle('startBrowserInput',async(event,url)=>{requireOperator(event);return browserInputs.start(url);});
ipcMain.handle('stopBrowserInput',async(event,id)=>{requireOperator(event);browserInputs.stop(id);});
app.on('before-quit',event=>{if(event.defaultPrevented)return;if(virtualCamera.active){event.preventDefault();void virtualCamera.stop().finally(()=>app.quit());return;}browserInputs.dispose();void networkInputs.dispose();void isoStore.abortAll();});

ipcMain.handle('beginIsoRecording',async(event,sources)=>{requireOperator(event);if(isoDialogOpen||isoStore.stores.size)throw Error('ISO recording is already open.');isoDialogOpen=true;try{const result=await dialog.showOpenDialog(operator,{title:'Choose ISO recording folder',properties:['openDirectory','createDirectory']});if(result.canceled||!result.filePaths[0])return {canceled:true};return await isoStore.begin(result.filePaths[0],sources);}finally{isoDialogOpen=false;}});
ipcMain.handle('writeIsoRecording',async(event,payload)=>{requireOperator(event);return isoStore.append(payload.id,payload.chunk);});
ipcMain.handle('finishIsoRecording',async(event,id)=>{requireOperator(event);return isoStore.finish(id);});
ipcMain.handle('abortIsoRecording',async(event,id)=>{requireOperator(event);return isoStore.abort(id);});

ipcMain.on('programSignal',(event,{target,signal})=>{try{requireOperator(event);}catch{return;}remote.sendProgramSignal(target,signal);});

ipcMain.handle('startVirtualCamera',async(event,password)=>{requireOperator(event);return virtualCamera.start(`http://127.0.0.1:${PORT}/program?token=${remote.programToken}`,password);});
ipcMain.handle('stopVirtualCamera',async event=>{requireOperator(event);return virtualCamera.stop();});

ipcMain.on('publishProduction',(event,production)=>{try{requireOperator(event);}catch{return;}state={...state,production};broadcast();});

ipcMain.handle('choosePresenterModel',async event=>{requireOperator(event);const result=await dialog.showOpenDialog(operator,{title:'Choose self-contained GLB avatar',properties:['openFile'],filters:[{name:'GLB avatar',extensions:['glb']}]});if(result.canceled||!result.filePaths[0])return null;return {name:path.basename(result.filePaths[0]),url:pathToFileURL(result.filePaths[0]).href};});
ipcMain.on('presenterError',(event,message)=>{if(event.sender===output?.webContents&&operator&&!operator.isDestroyed())operator.webContents.send('presenterError',String(message).slice(0,300));});

ipcMain.on('presenterAudioEnded',(event,id)=>{if(event.sender===output?.webContents&&operator&&!operator.isDestroyed())operator.webContents.send('presenterAudioEnded',id);});

ipcMain.handle('uploadCloudBackup',async(event,config)=>{requireOperator(event);return cloudBackup(config,'PUT');});
ipcMain.handle('downloadCloudBackup',async(event,config)=>{requireOperator(event);return cloudBackup(config,'GET');});

// Preserve configured stage windows before Electron closes them during application shutdown.
app.on('before-quit',event=>{if(!event.defaultPrevented&&stageDisplays){stageDisplays.save();stageDisplays.disposing=true;}});

let ndiQuitting=false;app.on('before-quit',event=>{if(event.defaultPrevented)return;if(ndiInputs.sessions.size&&!ndiQuitting){event.preventDefault();ndiQuitting=true;void ndiInputs.dispose().finally(()=>app.quit());}});

app.on('before-quit',()=>holyricsImport.cancel());

// Online generation credentials stay in the main process for this session only.
const {HunyuanClient}=require('./hunyuan-client');
const hunyuan=new HunyuanClient(()=>path.join(app.getPath('userData'),'generated3d'));
ipcMain.handle('connectHunyuan',(event,config)=>{requireStageOperator(event);return hunyuan.connect(config);});
ipcMain.handle('chooseHunyuanImage',async event=>{requireStageOperator(event);const result=await dialog.showOpenDialog(operator,{title:'Reference image for Hunyuan3D',properties:['openFile'],filters:[{name:'PNG or JPEG',extensions:['png','jpg','jpeg']}]});if(result.canceled||!result.filePaths[0])return null;return hunyuan.setImage(result.filePaths[0]);});
ipcMain.handle('generateHunyuan',(event,config)=>{requireStageOperator(event);return hunyuan.generate(config);});
ipcMain.handle('cancelHunyuan',event=>{requireStageOperator(event);hunyuan.cancel();});
ipcMain.handle('listHunyuanModels',event=>{requireStageOperator(event);return hunyuan.list();});
ipcMain.handle('saveHunyuanModel',async(event,id)=>{requireStageOperator(event);if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw Error('Choose a generated model.');const result=await dialog.showSaveDialog(operator,{title:'Save generated model',defaultPath:'GEN3D-Hunyuan.glb',filters:[{name:'GLB model',extensions:['glb']}]});if(result.canceled||!result.filePath)return false;await hunyuan.export(id,result.filePath);return true;});
app.on('before-quit',()=>hunyuan.cancel());
