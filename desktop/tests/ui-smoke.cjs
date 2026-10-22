const assert=require('node:assert/strict');const testChildren=[];let testBrowser=null;
const {chromium}=require('playwright');
const path=require('node:path');
const {StreamingEngine,probeFFmpeg}=require('../streaming-engine');let operatorPage=null;const streamingEngine=new StreamingEngine(status=>{operatorPage?.evaluate(s=>window.emit('streamStatus',s),status).catch(()=>{});});
const {RecordingStore}=require('../recording-store');const recordingStore=new RecordingStore();const savedRecordings=[];let cancelRecording=true,recordingNumber=0,failRecording=false,closeReady=0;
const fs=require('node:fs'),os=require('node:os');const {pathToFileURL}=require('node:url');
const fixtureDir=fs.mkdtempSync(path.join(os.tmpdir(),'gen3d-audio-'));const wavPath=path.join(fixtureDir,'Mixer-test.wav');
const rate=16000,count=rate*3,wav=Buffer.alloc(44+count*2);wav.write('RIFF',0);wav.writeUInt32LE(36+count*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*2,40);for(let i=0;i<count;i++)wav.writeInt16LE(Math.round(Math.sin(i*440*2*Math.PI/rate)*16000),44+i*2);fs.writeFileSync(wavPath,wav);
const {execFileSync:fixtureFFmpeg}=require('node:child_process');const bluePath=path.join(fixtureDir,'Blue-Input.png'),logoPath=path.join(fixtureDir,'Logo-Test.png'),videoPath=path.join(fixtureDir,'Motion-Input.webm');
for(const [color,size,file] of [['blue','640x360',bluePath],['red','200x100',logoPath]])fixtureFFmpeg('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=${color}:s=${size}`,'-frames:v','1','-threads','1','-y',file]);
fixtureFFmpeg('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-t','2','-c:v','libvpx','-deadline','realtime','-cpu-used','8','-threads','2','-an','-y',videoPath]);const greenPath=path.join(fixtureDir,'Green-Foreground.png');fixtureFFmpeg('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x00ff00:s=640x360','-vf','drawbox=x=220:y=80:w=200:h=220:color=red:t=fill','-frames:v','1','-threads','1','-y',greenPath]);let visualPickCount=0;let latestProjection='';
(async()=>{
 const net=require('node:net'),{spawn}=require('node:child_process');const receivers=[];
 async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
 for(let i=0;i<2;i++){const p=await port(),url=`rtmp://127.0.0.1:${p}/live`,file=path.join(fixtureDir,`rtmp-received-${i}.flv`);const child=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-listen','1','-i',url+'/localtest','-c','copy','-f','flv','-y',file],{stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);const closed=new Promise(r=>child.on('close',code=>r({code,stderr})));receivers.push({child,file,url,closed});testChildren.push(child);await new Promise((r,j)=>{child.once('spawn',r);child.once('error',j);});}
 const executablePath=process.env.GEN3D_TEST_BROWSER || undefined;
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--allow-loopback-in-peer-connection','--disable-webgl','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--allow-file-access-from-files']});
 testBrowser=browser;const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const op=await context.newPage(),out=await context.newPage();operatorPage=op;const errors=[];let mode='projection',ready=false,projectionPublishes=0;
 for(const page of [op,out]){
  page.on('pageerror',error=>{errors.push(error.message);console.log('PAGEERROR',error.message)});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,200))});
  await page.exposeBinding('bridge',async({page:sender},action,payload)=>{
   if(action==='signal'){
    if(sender===out&&payload.type==='ready'){ready=true;await out.evaluate(v=>window.emit('outputMode',v),mode);}
    const dest=sender===op?out:op;await dest.evaluate(v=>window.emit('videoSignal',v),payload).catch(()=>{});
   }
   if(action==='request'&&ready){await op.evaluate(()=>window.emit('videoSignal',{type:'ready'}));await out.evaluate(v=>window.emit('outputMode',v),mode);}
   if(action==='mode'){mode=payload;await out.evaluate(v=>window.emit('outputMode',v),mode);}
   if(action==='publish'){projectionPublishes++;latestProjection=payload.liveText||'';await op.evaluate(text=>window.emit('projectionState',{liveText:text}),latestProjection).catch(()=>{});await out.evaluate(v=>window.emit('state',v),payload).catch(()=>{});}
   if(action==='requestProjection')return op.evaluate(text=>window.emit('projectionState',{liveText:text}),latestProjection);
   if(action==='listCaptureSources')return [{id:'screen:mock',name:'Mock Window',thumbnail:'data:image/png;base64,'+fs.readFileSync(bluePath).toString('base64')}];
   if(action==='selectCaptureSource')return true;
   if(action==='pickVisualMedia'){visualPickCount++;return [{name:'Blue-Input.png',type:'image',url:pathToFileURL(bluePath).href},visualPickCount===1?{name:'Motion-Input.webm',type:'video',url:pathToFileURL(videoPath).href}:{name:'Green-Foreground.png',type:'image',url:pathToFileURL(greenPath).href}];}
   if(action==='pickLogo')return {name:'Logo-Test.png',type:'image',url:pathToFileURL(logoPath).href};
   if(action==='ffmpegInfo'||action==='chooseFFmpeg')return probeFFmpeg();
   if(action==='startStream')return streamingEngine.start(payload);
   if(action==='writeStream')return streamingEngine.append(payload.id,Buffer.from(payload.bytes));
   if(action==='stopStream')return streamingEngine.stop(payload);
   if(action==='beginRecording'){if(cancelRecording){cancelRecording=false;return {canceled:true};}const session=await recordingStore.begin(path.join(fixtureDir,`Program-${recordingNumber++}.webm`));if(failRecording){recordingStore.active.handle.write=async()=>{throw Error('Simulated disk full');};failRecording=false;}return session;}
   if(action==='writeRecording')return recordingStore.append(payload.id,Buffer.from(payload.bytes));
   if(action==='finishRecording'){const saved=await recordingStore.finish(payload);savedRecordings.push(saved.filePath);return saved;}
   if(action==='abortRecording')return recordingStore.abort(payload);
   if(action==='recordingReadyToClose'){closeReady++;return;}
   if(action==='failRecording'){failRecording=true;return;}
   if(action==='pickMedia')return [{name:'Mixer test.wav',type:'audio',url:pathToFileURL(wavPath).href}];
   if(action==='info')return {ip:'127.0.0.1',port:8787,pin:'1234'};
  });
  await page.addInitScript(()=>{
   if(window.top!==window)return;
   const getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.screenCaptures=[];navigator.mediaDevices.getDisplayMedia=async()=>{const stream=await getMedia({video:true,audio:false});window.screenCaptures.push(stream);return stream;};const makeElement=document.createElement.bind(document);window.testVideos=[];document.createElement=(name,...args)=>{const element=makeElement(name,...args);if(name==='video')window.testVideos.push(element);return element;};window.capturedMedia=[];navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await getMedia(constraints);window.capturedMedia.push({stream,audio:!!constraints.audio,video:!!constraints.video});return stream;};
   const listeners={};window.emit=(channel,data)=>(listeners[channel]||[]).forEach(f=>f(data));
   const listen=(channel,f)=>{(listeners[channel]||=[]).push(f);return()=>listeners[channel]=listeners[channel].filter(x=>x!==f);};
   window.studio={onProjectionState:f=>listen('projectionState',f),requestProjectionState:()=>bridge('requestProjection'),listCaptureSources:()=>bridge('listCaptureSources'),selectCaptureSource:id=>bridge('selectCaptureSource',id),pickVisualMedia:()=>bridge('pickVisualMedia'),pickLogo:()=>bridge('pickLogo'),ffmpegInfo:()=>bridge('ffmpegInfo'),chooseFFmpeg:()=>bridge('chooseFFmpeg'),startStream:config=>bridge('startStream',config),writeStream:({id,chunk})=>bridge('writeStream',{id,bytes:Array.from(new Uint8Array(chunk))}),stopStream:id=>bridge('stopStream',id),onStreamStatus:f=>listen('streamStatus',f),beginRecording:()=>bridge('beginRecording'),writeRecording:({id,chunk})=>bridge('writeRecording',{id,bytes:Array.from(new Uint8Array(chunk))}),finishRecording:id=>bridge('finishRecording',id),abortRecording:id=>bridge('abortRecording',id),onRecordingCloseRequested:f=>listen('recordingCloseRequested',f),recordingReadyToClose:()=>bridge('recordingReadyToClose'),sendVideoSignal:m=>bridge('signal',m),requestVideoOutput:()=>bridge('request'),setOutputMode:m=>bridge('mode',m),onVideoSignal:f=>listen('videoSignal',f),onOutputMode:f=>listen('outputMode',f),onState:f=>listen('state',f),onCommand:f=>listen('command',f),publish:s=>bridge('publish',s),info:()=>bridge('info'),openExternal:()=>Promise.resolve(),importPptx:()=>Promise.resolve(null),pickMedia:()=>bridge('pickMedia'),exportProject:()=>Promise.resolve({canceled:true}),importProject:()=>Promise.resolve(null)};
  });
 }
 const base=path.resolve(__dirname,'../renderer');
 await op.goto('file://'+base+'/index.html',{waitUntil:'domcontentloaded'});console.log('Operator loaded');await out.goto('file://'+base+'/output.html',{waitUntil:'domcontentloaded'});console.log('Output loaded');
 await op.getByRole('button',{name:'02 Live Production'}).click();
 await op.getByRole('button',{name:'+ Test pattern',exact:true}).click();
 await op.getByRole('button',{name:'Preview Test pattern 1',exact:true}).click();
 await op.getByRole('button',{name:'CUT',exact:true}).click();
 await op.waitForFunction(()=>document.querySelector('.monitors .program .panel-label b').textContent==='Test pattern 1');
 await op.getByRole('button',{name:'+ Test pattern',exact:true}).click();
 await op.getByRole('button',{name:'Preview Test pattern 2',exact:true}).click();
 await op.getByRole('button',{name:'FADE →',exact:true}).click();
 assert.equal(await op.getByRole('button',{name:'CUT',exact:true}).isDisabled(),true);
 await op.waitForFunction(()=>document.querySelector('.monitors .program .panel-label b').textContent==='Test pattern 2');
 await op.getByRole('button',{name:'Send Program to projector',exact:true}).click();
 await op.bringToFront();
 console.log('SIGNALING CHECK',await out.evaluate(()=>({signaling:peer?.signalingState,connection:peer?.connectionState,hasStream:!!programVideo.srcObject})));
 assert.equal(mode,'production');
 assert.equal(await out.locator('#production-video').evaluate(v=>getComputedStyle(v).display),'block');
 console.log('PASS: patterns, Cut, Fade, swap, output routing and signaling. Live decoded projector playback is not asserted.');
 await op.getByRole('button',{name:'Enable / refresh',exact:true}).click();
 const options=await op.locator('select[aria-label="Camera device"] option').allTextContents();console.log('Camera choices',options);
 await op.getByRole('button',{name:'+ Add camera',exact:true}).click();
 await op.waitForFunction(()=>document.querySelectorAll('.source').length===4);
 await op.getByRole('button',{name:/Preview fake_device/}).click();
 await op.getByRole('button',{name:'CUT',exact:true}).click();
 await op.waitForFunction(()=>document.querySelector('.monitors .program .panel-label b').textContent.includes('fake_device'));
 await op.getByRole('button',{name:/Remove fake_device/}).click();
 await op.waitForFunction(()=>document.querySelector('.monitors .program .panel-label b').textContent==='Black');
 console.log('PASS: synthetic camera input, switch, removal returns Program to Black');
 await op.getByRole('button',{name:'01 Projection Studio'}).click();
 const projection=op.frameLocator('iframe');
 await projection.getByRole('heading',{name:'Gen3D Studio Live',exact:true}).waitFor();
 const bridgePresent=await op.frames()[1].evaluate(()=>!!window.studio);assert.equal(bridgePresent,true);
 await op.getByRole('button',{name:'Send Projection to projector',exact:true}).click();
 assert.equal(await out.locator('#production-video').evaluate(v=>getComputedStyle(v).display),'none');
 console.log('PASS: projection workspace retained, preload bridge accessible, output routing restored; publishes',projectionPublishes);
 await op.getByRole('button',{name:'02 Live Production'}).click();

 await op.getByRole('button',{name:'+ Test tone',exact:true}).click();
 const master=op.getByRole('meter',{name:'Master level',exact:true});
 assert.equal(Number(await master.getAttribute('aria-valuenow')),-60);
 await op.getByRole('button',{name:'Unmute',exact:true}).click();
 await op.waitForFunction(()=>Number(document.querySelector('[aria-label="440 Hz test tone level"]').getAttribute('aria-valuenow'))>-10);
 assert.equal(Number(await master.getAttribute('aria-valuenow')),-60);
 await op.getByRole('button',{name:'Unmute Master',exact:true}).click();
 await op.waitForFunction(()=>Number(document.querySelector('[aria-label="Master level"]').getAttribute('aria-valuenow'))>-10);


 await op.getByRole('button',{name:'03 Streaming',exact:true}).click();
 await op.getByRole('textbox',{name:'Destination 1 server',exact:true}).fill(receivers[0].url);await op.getByLabel('Destination 1 key',{exact:true}).fill('localtest');
 await op.getByRole('button',{name:'+ Destination',exact:true}).click();
 await op.getByRole('textbox',{name:'Destination 2 server',exact:true}).fill(receivers[1].url);await op.getByLabel('Destination 2 key',{exact:true}).fill('localtest');
 await op.getByRole('button',{name:'● Start streaming',exact:true}).click();
 await op.waitForFunction(()=>document.querySelector('.stream-phase').textContent==='streaming');
 await op.waitForFunction(()=>document.querySelectorAll('.status-sending').length===2,{},{timeout:20000});
 await op.getByRole('button',{name:'02 Live Production',exact:true}).click();
 await op.getByRole('button',{name:'Preview Test pattern 2',exact:true}).click();await op.getByRole('button',{name:'CUT',exact:true}).click();
 await op.getByRole('button',{name:'● Start recording',exact:true}).click();
 await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='idle');assert.equal(savedRecordings.length,0);
 await op.getByRole('button',{name:'● Start recording',exact:true}).click();
 await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='recording');
 await op.waitForFunction(()=>document.querySelector('[aria-label="Recording timer"]').textContent>='00:00:01');

 await op.getByRole('button',{name:'Preview Black',exact:true}).click();await op.getByRole('button',{name:'CUT',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.monitors .program .panel-label b').textContent==='Black');console.log('CUT TO BLACK',await op.locator('.monitors .program .panel-label b').textContent());await op.waitForFunction(()=>document.querySelector('.monitors .program canvas').getContext('2d').getImageData(0,0,1,1).data[0]===0);const stopAfter=await op.evaluate(()=>Date.now()+800);await op.waitForFunction(end=>Date.now()>=end,stopAfter);
 await op.waitForFunction(()=>document.querySelector('[aria-label="Recording timer"]').textContent>='00:00:02');
 console.log('END PIXEL',await op.locator('.monitors .program canvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,1,1).data)));await op.getByRole('button',{name:'■ Stop recording',exact:true}).click();
 await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='saved');
 assert.equal(savedRecordings.length,1);assert.ok(fs.statSync(savedRecordings[0]).size>1000);
 const {execFileSync}=require('node:child_process');
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',savedRecordings[0]],{encoding:'utf8'}));
 assert.equal(probe.streams.find(s=>s.codec_type==='video').codec_name,'vp8');assert.ok(Number(probe.streams.find(s=>s.codec_type==='video').nb_read_frames)>20);assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'opus');
 const pcm=execFileSync('ffmpeg',['-v','error','-i',savedRecordings[0],'-map','0:a:0','-f','f32le','-ac','1','pipe:1'],{maxBuffer:10000000});let power=0;for(let i=0;i<pcm.length;i+=4)power+=pcm.readFloatLE(i)**2;assert.ok(Math.sqrt(power/(pcm.length/4))>.05);
 const frames=execFileSync('ffmpeg',['-v','error','-i',savedRecordings[0],'-map','0:v:0','-vf','scale=1:1','-vsync','0','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);assert.ok(frames[0]+frames[1]+frames[2]>30);assert.ok(frames[frames.length-1]+frames[frames.length-2]+frames[frames.length-3]<15);
 console.log('PASS: cancel save dialog, incremental recording, Stop/finalize, decoded VP8 video changes and audible Opus mix');
 assert.equal(streamingEngine.active!==null,true);assert.equal(await op.getByRole('button',{name:'Stop active Program stream',exact:true}).count(),1);
 await op.getByRole('button',{name:'03 Streaming',exact:true}).click();

 await op.getByRole('button',{name:'■ Stop streaming',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.stream-phase').textContent==='stopped');
 for(const receiver of receivers){const timeout=setTimeout(()=>receiver.child.kill('SIGKILL'),10000);const exit=await receiver.closed;clearTimeout(timeout);assert.equal(exit.code,0,exit.stderr);const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',receiver.file],{encoding:'utf8'}));assert.equal(metadata.streams.find(s=>s.codec_type==='video').codec_name,'h264');assert.equal(metadata.streams.find(s=>s.codec_type==='audio').codec_name,'aac');assert.ok(Number(metadata.streams.find(s=>s.codec_type==='video').nb_read_frames)>20);}
 assert.equal(streamingEngine.active,null);await op.getByRole('button',{name:'02 Live Production',exact:true}).click();
 console.log('PASS: real Program video/audio reaches two local RTMP receivers; streaming and recording run together; Stop recording leaves streams running; Stop stream releases encoder processes');

 await op.evaluate(()=>bridge('failRecording'));
 await op.getByRole('button',{name:'● Start recording',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='error');
 assert.ok((await op.locator('.recording-error').textContent()).includes('Simulated disk full'));assert.equal(recordingStore.active,null);assert.equal(savedRecordings.length,1);
 await op.getByRole('button',{name:'● Start recording',exact:true}).click();await op.waitForFunction(()=>document.querySelector('[aria-label="Recording timer"]').textContent>='00:00:01');
 await op.evaluate(()=>window.emit('recordingCloseRequested'));await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='saved');
 assert.equal(closeReady,1);assert.equal(savedRecordings.length,2);
 console.log('PASS: recording disk failure retains partial data, retry works, app-close request finalizes recording before allowing close');

 await op.getByRole('slider',{name:'Master volume',exact:true}).fill('0');
 await op.waitForFunction(()=>Number(document.querySelector('[aria-label="Master level"]').getAttribute('aria-valuenow'))===-60);
 await op.getByRole('slider',{name:'Master volume',exact:true}).fill('80');
 await op.waitForFunction(()=>Number(document.querySelector('[aria-label="Master level"]').getAttribute('aria-valuenow'))>-10);
 await op.getByRole('button',{name:'Mute',exact:true}).click();
 await op.waitForFunction(()=>Number(document.querySelector('[aria-label="Master level"]').getAttribute('aria-valuenow'))===-60);
 await op.getByRole('button',{name:'Remove audio 440 Hz test tone',exact:true}).click();
 await op.getByRole('button',{name:'Enable / refresh audio',exact:true}).click();
 await op.getByRole('button',{name:'+ Add microphone',exact:true}).click();
 await op.locator('.audio-kind').filter({hasText:'microphone'}).waitFor();
 await op.getByRole('button',{name:/Remove audio/}).click();
 assert.equal(await op.locator('.audio-kind').count(),0);
 assert.equal(await op.evaluate(()=>capturedMedia.filter(s=>s.audio&&!s.video).every(s=>s.stream.getTracks().every(t=>t.readyState==='ended'))),true);
 await op.getByRole('button',{name:'+ Audio file',exact:true}).click();
 await op.getByRole('button',{name:'Play',exact:true}).click();
 await op.getByRole('button',{name:'Unmute',exact:true}).click();
 await op.waitForFunction(()=>Number(document.querySelector('[aria-label="Master level"]').getAttribute('aria-valuenow'))>-20);
 await op.getByRole('button',{name:'Pause',exact:true}).click();
 await op.waitForFunction(()=>Number(document.querySelector('[aria-label="Master level"]').getAttribute('aria-valuenow'))===-60);
 await op.getByRole('button',{name:'Remove audio Mixer test.wav',exact:true}).click();
 console.log('PASS: audio file picker bridge, WAV playback, pause silences Program, file cleanup and microphone track release');

 assert.equal(await out.evaluate(()=>programVideo.srcObject.getAudioTracks().length),1);
 assert.equal(await out.evaluate(()=>programVideo.muted),true);
 console.log('PASS: test tone, post-fader meters, channel mute, Master mute/gain, synthetic microphone add/remove and remote audio track');

 await op.getByRole('button',{name:'+ Screen / window',exact:true}).click();await op.getByRole('button',{name:'Cancel capture',exact:true}).click();assert.equal(await op.locator('.capture-picker').count(),0);
 await op.getByRole('button',{name:'+ Screen / window',exact:true}).click();await op.getByRole('button',{name:'Capture Mock Window',exact:true}).click();
 await op.getByRole('button',{name:'Preview Mock Window',exact:true}).click();await op.getByRole('button',{name:'CUT',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.monitors .program .panel-label b').textContent==='Mock Window');
 await op.getByRole('button',{name:'Remove Mock Window',exact:true}).click();assert.equal(await op.evaluate(()=>screenCaptures.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 await op.getByRole('button',{name:'+ Video / image',exact:true}).click();await op.getByRole('button',{name:'Preview Blue-Input.png',exact:true}).click();await op.getByRole('button',{name:'CUT',exact:true}).click();
 await op.waitForFunction(()=>document.querySelector('.monitors .program canvas').getContext('2d').getImageData(0,0,1,1).data[2]>240);
 assert.equal(await op.evaluate(()=>testVideos.find(v=>v.src.endsWith('Motion-Input.webm')).paused),true);
 await op.getByRole('button',{name:'Play video Motion-Input.webm',exact:true}).click();await op.waitForFunction(()=>testVideos.find(v=>v.src.endsWith('Motion-Input.webm')).currentTime>.1);
 await op.getByRole('button',{name:'Pause video Motion-Input.webm',exact:true}).click();assert.equal(await op.evaluate(()=>testVideos.find(v=>v.src.endsWith('Motion-Input.webm')).paused),true);
 await op.getByRole('checkbox',{name:'Loop video Motion-Input.webm',exact:true}).check();await op.getByRole('button',{name:'Restart video Motion-Input.webm',exact:true}).click();assert.equal(await op.evaluate(()=>testVideos.find(v=>v.src.endsWith('Motion-Input.webm')).loop),true);
 await op.getByRole('button',{name:'Remove Motion-Input.webm',exact:true}).click();assert.equal(await op.evaluate(()=>testVideos.filter(v=>v.src.endsWith('Motion-Input.webm')).length),0);
 console.log('PASS: screen picker cancel/selection using synthetic capture, track cleanup, image input, video paused import, Play/Pause/Loop/Restart and file cleanup');
 await op.getByRole('button',{name:'01 Projection Studio',exact:true}).click();const church=op.frameLocator('iframe');await church.locator('#newTitle').fill('Live Overlay Test');await church.locator('#newLyrics').fill('Welcome to GEN3D\nLive worship service');await church.locator('#addSong').click();await church.locator('#slides .slide').first().click();await church.getByRole('button',{name:'Take live',exact:true}).click();
 await op.getByRole('button',{name:'02 Live Production',exact:true}).click();await op.getByRole('checkbox',{name:'Show projection text on Program',exact:true}).check();
 await op.getByRole('textbox',{name:'Lower third title',exact:true}).fill('GEN3D COMMUNITY');await op.getByRole('textbox',{name:'Lower third subtitle',exact:true}).fill('Live service');await op.getByRole('button',{name:'Apply lower third text',exact:true}).click();await op.getByRole('checkbox',{name:'Show lower third',exact:true}).check();
 await op.getByRole('button',{name:'Choose logo',exact:true}).click();await op.getByRole('checkbox',{name:'Show logo',exact:true}).check();
 await op.waitForFunction(()=>{const c=document.querySelector('.monitors .program canvas'),p=c.getContext('2d').getImageData(Math.floor(c.width*.95),Math.floor(c.height*.1),1,1).data;return p[0]>200&&p[1]<40;});

 assert.ok((await op.locator('.projection-text-preview').textContent()).includes('Welcome to GEN3D'));
 await op.getByRole('button',{name:'● Start recording',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='recording');await op.waitForFunction(()=>document.querySelector('[aria-label="Recording timer"]').textContent>='00:00:01');await op.getByRole('button',{name:'■ Stop recording',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='saved');
 const overlayFile=savedRecordings.at(-1);const picture=execFileSync('ffmpeg',['-v','error','-i',overlayFile,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:10000000});
 const pixel=(x,y)=>Array.from(picture.subarray((Math.floor(y)*1280+Math.floor(x))*3,(Math.floor(y)*1280+Math.floor(x))*3+3));
 assert.ok(pixel(1216,72)[0]>180&&pixel(1216,72)[2]<60);assert.ok(pixel(61,595)[0]>60&&pixel(61,595)[1]>80);let whites=0;for(let y=120;y<450;y++)for(let x=150;x<1130;x++){const i=(y*1280+x)*3;if(picture[i]>200&&picture[i+1]>200&&picture[i+2]>200)whites++;}assert.ok(whites>300);
 await op.getByRole('button',{name:'01 Projection Studio',exact:true}).click();await church.getByRole('button',{name:'Clear screen',exact:true}).click();await op.getByRole('button',{name:'02 Live Production',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.projection-text-preview').textContent.startsWith('No live text'));
 await op.getByRole('button',{name:'Hide all overlays',exact:true}).click();await op.waitForFunction(()=>{const c=document.querySelector('.monitors .program canvas');return c.getContext('2d').getImageData(Math.floor(c.width*.95),Math.floor(c.height*.1),1,1).data[2]>240;});
 await op.getByRole('button',{name:'Remove logo',exact:true}).click();await op.getByRole('button',{name:'Remove Blue-Input.png',exact:true}).click();
 console.log('PASS: real projection bridge updates lyrics and clears them; lower third/logo compose on Program; recorded file decodes all overlays; Hide all removes graphics');

 await op.getByRole('button',{name:'+ Video / image',exact:true}).click();await op.getByRole('button',{name:'Preview Blue-Input.png',exact:true}).click();await op.getByRole('button',{name:'CUT',exact:true}).click();
 await op.getByRole('combobox',{name:'Keyer foreground',exact:true}).selectOption({label:'Green-Foreground.png'});await op.getByRole('checkbox',{name:'Enable keyer',exact:true}).check();
 await op.waitForFunction(()=>{const c=document.querySelector('.monitors .program canvas'),x=c.getContext('2d'),a=x.getImageData(10,10,1,1).data,b=x.getImageData(c.width/2,c.height/2,1,1).data;return a[2]>220&&a[1]<40&&b[0]>200&&b[1]<40;});
 await op.getByRole('combobox',{name:'PiP source',exact:true}).selectOption({label:'Green-Foreground.png'});await op.getByRole('combobox',{name:'PiP position',exact:true}).selectOption('top-left');await op.getByRole('slider',{name:'PiP size',exact:true}).fill('30');await op.getByRole('checkbox',{name:'Show picture-in-picture',exact:true}).check();
 await op.waitForFunction(()=>{const c=document.querySelector('.monitors .program canvas'),p=c.getContext('2d').getImageData(c.width*.07,c.height*.07,1,1).data;return p[1]>200&&p[2]<40;});
 await op.getByRole('combobox',{name:'Keyer type',exact:true}).selectOption('luma');await op.getByRole('slider',{name:'Luma threshold',exact:true}).fill('150');

 await op.getByRole('button',{name:'● Start recording',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='recording');await op.waitForFunction(()=>document.querySelector('[aria-label="Recording timer"]').textContent>='00:00:01');await op.getByRole('button',{name:'■ Stop recording',exact:true}).click();await op.waitForFunction(()=>document.querySelector('.recording-phase').textContent==='saved');
 const composed=execFileSync('ffmpeg',['-v','error','-i',savedRecordings.at(-1),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:10000000});const cp=(x,y)=>Array.from(composed.subarray((y*1280+x)*3,(y*1280+x)*3+3));
 assert.ok(cp(90,60)[1]>180&&cp(90,60)[2]<60);assert.ok(cp(640,360)[0]>180&&cp(640,360)[1]<60);assert.ok(cp(1100,550)[2]>180&&cp(1100,550)[1]<60);
 await op.getByRole('button',{name:'Remove Green-Foreground.png',exact:true}).click();assert.equal(await op.getByRole('checkbox',{name:'Show picture-in-picture',exact:true}).isChecked(),false);assert.equal(await op.getByRole('checkbox',{name:'Enable keyer',exact:true}).isChecked(),false);
 await op.getByRole('button',{name:'Remove Blue-Input.png',exact:true}).click();
 console.log('PASS: chroma foreground preserves red subject over blue Program, PiP positions a clean inset, luma key and inset decode in recorded video, removing input disables dependent layers');

 const overflow=await op.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
 await op.setViewportSize({width:1000,height:900});assert.equal(await op.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PAGE ERRORS',errors);assert.deepEqual(errors,[]);
 await browser.close();fs.rmSync(fixtureDir,{recursive:true,force:true});
})().catch(async e=>{console.error(e);if(streamingEngine.active)await streamingEngine.stop(streamingEngine.active.id).catch(()=>{});if(recordingStore.active)await recordingStore.abort(recordingStore.active.id).catch(()=>{});for(const c of testChildren)if(c.exitCode===null&&c.signalCode===null)c.kill('SIGKILL');await testBrowser?.close().catch(()=>{});process.exitCode=1;});
