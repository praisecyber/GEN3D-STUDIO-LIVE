// Local-only RTMP integration. Requires FFmpeg with libx264/libvpx/libopus/AAC and FFprobe.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn,execFile}=require('node:child_process');const {promisify}=require('node:util');
const {StreamingEngine}=require('../streaming-engine');
const run=promisify(execFile),ffmpeg=process.env.GEN3D_FFMPEG||'ffmpeg',ffprobe=process.env.GEN3D_FFPROBE||'ffprobe';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function port(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const result=server.address().port;await new Promise(resolve=>server.close(resolve));return result;}
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gen3d-rtmp-'));const receivers=[];const statuses=[];const engine=new StreamingEngine(s=>statuses.push(s));
 try{
  const fixture=path.join(dir,'input.webm');
  await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=1280x720:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','3','-c:v','libvpx','-deadline','realtime','-cpu-used','8','-threads','2','-c:a','libopus','-y',fixture],{timeout:20000});
  const destinations=[];
  for(let i=0;i<2;i++){
   const p=await port(),file=path.join(dir,`received-${i}.flv`),url=`rtmp://127.0.0.1:${p}/live/localtest`;
   const child=spawn(ffmpeg,['-hide_banner','-loglevel','warning','-listen','1','-i',url,'-c','copy','-f','flv','-y',file],{stdio:['ignore','ignore','pipe']});
   let stderr='';child.stderr.on('data',b=>stderr+=b.toString());const closed=new Promise(resolve=>child.on('close',code=>resolve({code,stderr})));receivers.push({child,file,closed});
   await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
   destinations.push({label:`Local ${i+1}`,server:url,key:''});
  }
  const refused=await port();destinations.push({label:'Unavailable destination',server:`rtmp://127.0.0.1:${refused}/live/hidden-test-key`,key:''});await delay(300);
  const session=await engine.start({destinations,bitrate:3000},ffmpeg);const input=await fs.readFile(fixture);
  for(let i=0;i<input.length;i+=32768){await engine.append(session.id,input.subarray(i,i+32768));await delay(12);}
  // Keep the live input open until FFmpeg reports progress; fast fixture ingestion must not race Stop.
  const progressDeadline=Date.now()+5000;while(Date.now()<progressDeadline&&!statuses.some(s=>s.destinations.some(d=>d.status==='sending')))await delay(50);
  const result=await engine.stop(session.id);
  assert.equal(result.destinations.filter(d=>d.status==='failed').length,1);assert.equal(engine.active,null);
  assert.equal(JSON.stringify(statuses).includes('hidden-test-key'),false);
  for(const receiver of receivers){const timeout=setTimeout(()=>receiver.child.kill('SIGKILL'),10000);const exit=await receiver.closed;clearTimeout(timeout);assert.equal(exit.code,0,exit.stderr);const probe=JSON.parse((await run(ffprobe,['-v','error','-count_frames','-show_streams','-of','json',receiver.file])).stdout);assert.equal(probe.streams.find(s=>s.codec_type==='video').codec_name,'h264');assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'aac');assert.ok(Number(probe.streams.find(s=>s.codec_type==='video').nb_read_frames)>50);}
  assert.ok(statuses.some(s=>s.destinations.some(d=>d.status==='sending')));
  console.log('PASS: two local RTMP receivers decode H.264/AAC; failed third destination is isolated; Stop cleans encoder processes; stream credentials absent from status.');
 }finally{if(engine.active)await engine.stop(engine.active.id);for(const r of receivers)if(r.child.exitCode===null&&r.child.signalCode===null)r.child.kill('SIGKILL');await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
