const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {randomUUID}=require('node:crypto');
function destinationUrl(config){
  const base=String(config.server||'').trim(),key=String(config.key||'').trim();
  if(base.length>4096||key.length>1024)throw Error('The publishing URL or key is too long.');
  if(!base||/[\s\x00-\x1f]/.test(base+key))throw Error('Enter a valid RTMP server and stream key without whitespace.');
  let u;try{u=new URL(base);}catch{throw Error('Enter a valid RTMP or RTMPS server URL.');}
  if(!['rtmp:','rtmps:'].includes(u.protocol)||!u.hostname||u.hash)throw Error('Only RTMP and RTMPS publishing URLs are supported.');
  if(key&&u.search)throw Error('For a server URL with query authentication, paste the complete publishing URL and leave the key field blank.');
  const url=key?base.replace(/\/+$/,'')+'/'+key:base;
  if(new URL(url).hash)throw Error('Publishing URLs cannot contain a fragment.');
  return url;
}
function redact(text,secrets=[]){
  let result=String(text);
  for(const secret of [...secrets].filter(Boolean).sort((a,b)=>b.length-a.length))result=result.split(secret).join('[redacted]');
  return result.replace(/rtmps?:\/\/[^\s'"<>]+/gi,'[publishing URL]');
}
async function probeFFmpeg(executable='ffmpeg'){
  try{const {stdout}=await promisify(execFile)(executable,['-version'],{timeout:5000,maxBuffer:1024*1024,windowsHide:true});if(!stdout.startsWith('ffmpeg version'))throw Error();return {available:true,version:stdout.split('\n')[0].slice(0,180),executable};}
  catch{throw Error('FFmpeg is unavailable. Choose ffmpeg.exe or add FFmpeg to PATH.');}
}
function encoderError(stderr,code){
  if(/unknown encoder|encoder.*not found/i.test(stderr))return 'FFmpeg needs the libx264 and AAC encoders.';
  if(/connection refused|cannot open connection|connection timed out/i.test(stderr))return 'Connection failed. Check the server URL, port and network.';
  return `Publishing stopped (encoder exit ${code??'unknown'}). Check the server, stream key, network and FFmpeg build.`;
}
function encoderArgs(url,bitrate=3000){
  return ['-hide_banner','-loglevel','warning','-nostats','-progress','pipe:1','-stats_period','1','-fflags','+genpts','-probesize','1000000','-analyzeduration','1000000','-f','webm','-i','pipe:0','-map','0:v:0','-map','0:a:0','-c:v','libx264','-threads','2','-preset','veryfast','-tune','zerolatency','-pix_fmt','yuv420p','-r','30','-g','60','-keyint_min','60','-b:v',`${bitrate}k`,'-maxrate',`${bitrate}k`,'-bufsize',`${bitrate*2}k`,'-c:a','aac','-b:a','128k','-ar','48000','-rw_timeout','10000000','-f','flv','-flvflags','no_duration_filesize',url];
}
class StreamingEngine{
  constructor(onStatus=()=>{}){this.active=null;this.onStatus=onStatus;}
  snapshot(s=this.active){return s?{id:s.id,phase:s.closing?'stopping':s.destinations.every(d=>d.status==='failed')?'error':s.destinations.some(d=>d.status==='sending')?'sending':'connecting',bytes:s.bytes,destinations:s.destinations.map(({label,status,frames,error})=>({label,status,frames,error}))}:null;}
  emit(s){this.onStatus(this.snapshot(s));}
  async start(config,executable='ffmpeg'){
    if(this.active)throw Error('A stream is already running.');
    if(!Array.isArray(config.destinations)||config.destinations.length<1||config.destinations.length>3)throw Error('Configure one to three publishing destinations.');
    const urls=config.destinations.map(destinationUrl);if(new Set(urls).size!==urls.length)throw Error('Publishing destinations must be different.');
    const bitrate=Number(config.bitrate);if(![2500,3000,4000,6000].includes(bitrate))throw Error('Select a supported video bitrate.');
    const s={id:randomUUID(),destinations:[],bytes:0,closing:false,tail:Promise.resolve()};this.active=s;
    try{
      for(let i=0;i<urls.length;i++){
        if(s.closing)throw Error('Streaming startup was stopped.');
        const source=config.destinations[i];const d={label:String(source.label||`Destination ${i+1}`).slice(0,60),status:'connecting',frames:0,error:'',stderr:'',buffer:''};
        d.process=spawn(executable,encoderArgs(urls[i],bitrate),{windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});s.destinations.push(d);
        d.closed=new Promise(resolve=>d.resolveClose=resolve);
        d.process.stdin.on('error',()=>{});
        d.process.stderr.on('data',chunk=>{d.stderr=(d.stderr+chunk.toString()).slice(-4000);});
        d.process.stdout.on('data',chunk=>{d.buffer+=chunk.toString();let pos;while((pos=d.buffer.indexOf('\n'))>=0){const line=d.buffer.slice(0,pos).trim();d.buffer=d.buffer.slice(pos+1);if(line.startsWith('frame='))d.frames=Number(line.slice(6))||0;if(line.startsWith('out_time_us=')&&Number(line.slice(12))>0&&!s.closing){d.status='sending';this.emit(s);}}});
        d.process.on('error',()=>{d.status='failed';d.error='Unable to start FFmpeg. Check the selected executable.';this.emit(s);});
        d.process.on('close',code=>{d.status=s.closing&&code===0?'stopped':'failed';if(d.status==='failed')d.error=encoderError(d.stderr,code);d.resolveClose();this.emit(s);});
        await new Promise((resolve,reject)=>{d.process.once('spawn',resolve);d.process.once('error',reject);});
      }
      this.emit(s);return this.snapshot(s);
    }catch{await this.stop(s.id);throw Error('Unable to start the streaming encoders. Check FFmpeg.');}
  }
  requireSession(id){if(!this.active||this.active.id!==id)throw Error('Streaming session is no longer running.');return this.active;}
  async append(id,chunk){
    const s=this.requireSession(id);if(s.closing)throw Error('Streaming is stopping.');
    if(!(chunk instanceof ArrayBuffer)&&!ArrayBuffer.isView(chunk))throw Error('Invalid stream data.');
    const data=chunk instanceof ArrayBuffer?Buffer.from(chunk):Buffer.from(chunk.buffer,chunk.byteOffset,chunk.byteLength);
    if(!data.length||data.length>16*1024*1024)throw Error('Streaming chunk is too large.');
    const operation=s.tail.then(async()=>{
      const live=s.destinations.filter(d=>!['failed','stopped'].includes(d.status));if(!live.length)throw Error('All publishing destinations disconnected.');
      await Promise.all(live.map(d=>new Promise(resolve=>{
        let finished=false;const done=error=>{if(finished)return;finished=true;clearTimeout(timer);if(error){d.status='failed';d.error='Publishing connection could not accept data. Check the network and server.';d.process.kill();this.emit(s);}resolve();};
        const timer=setTimeout(()=>done(Error('Publishing timeout')),10000);
        try{d.process.stdin.write(data,error=>done(error));}catch(error){done(error);}
      })));
      if(s.destinations.every(d=>d.status==='failed'))throw Error('All publishing destinations disconnected.');
      s.bytes+=data.length;return {bytes:s.bytes};
    });s.tail=operation.catch(()=>{});return operation;
  }
  async stop(id){
    const s=this.requireSession(id);if(s.stopPromise)return s.stopPromise;s.closing=true;this.emit(s);
    s.stopPromise=(async()=>{
      await s.tail;
      await Promise.all(s.destinations.map(async d=>{
        if(d.process.exitCode!==null||d.process.signalCode!==null){await d.closed;return;}
        const timer=setTimeout(()=>d.process.kill('SIGKILL'),6000);
        try{d.process.stdin.end();}catch{d.process.kill();}
        await d.closed;clearTimeout(timer);
      }));
      const result={id:s.id,bytes:s.bytes,destinations:this.snapshot(s).destinations};if(this.active===s)this.active=null;return result;
    })();return s.stopPromise;
  }
}
module.exports={StreamingEngine,destinationUrl,redact,encoderArgs,encoderError,probeFFmpeg};
