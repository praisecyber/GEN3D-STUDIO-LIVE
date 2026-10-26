const http=require('node:http');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
function validateNetworkUrl(value){
 const text=String(value||'').trim();if(text.length>8192||/[\s\x00-\x1f]/.test(text))throw Error('Enter a network stream URL without whitespace.');
 let url;try{url=new URL(text);}catch{throw Error('Enter a complete RTMP, RTMPS, SRT, HTTP or HTTPS stream URL.');}
 if(!['rtmp:','rtmps:','srt:','http:','https:'].includes(url.protocol)||!url.hostname||url.hash)throw Error('Only RTMP, RTMPS, SRT and direct HTTP(S) media streams are supported.');return text;
}
function inputArgs(url){return ['-hide_banner','-loglevel','error','-rw_timeout','15000000','-i',url,'-map','0:v:0','-map','0:a:0?','-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2','-r','30','-c:v','libx264','-threads','2','-profile:v','baseline','-level:v','3.1','-pix_fmt','yuv420p','-preset','ultrafast','-tune','zerolatency','-g','30','-c:a','aac','-ar','48000','-b:a','128k','-movflags','frag_keyframe+empty_moov+default_base_moof','-f','mp4','pipe:1'];}
class NetworkInputs{
 constructor(){this.sessions=new Map();}
 async start(rawUrl,ffmpeg='ffmpeg'){
  const url=validateNetworkUrl(rawUrl);if(this.sessions.size>=8)throw Error('Eight network inputs are already open.');
  const id=randomUUID(),token=randomUUID(),session={id,token,child:null,closing:false,connected:false};this.sessions.set(id,session);
  const server=http.createServer((request,response)=>{
   if(request.method!=='GET'||request.url!=='/'+token){response.writeHead(404);response.end();return;}
   if(session.connected){response.writeHead(409);response.end();return;}session.connected=true;session.response=response;
   response.setHeader('Content-Type','video/mp4');response.setHeader('Access-Control-Allow-Origin','*');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
   const child=spawn(ffmpeg,inputArgs(url),{stdio:['ignore','pipe','pipe'],windowsHide:true});session.child=child;
   child.stderr.resume();child.stdout.pipe(response);child.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end();});
   child.on('close',()=>{response.end();});response.on('close',()=>{if(!session.closing)void this.stop(id);});
  });session.server=server;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return {id,url:`http://127.0.0.1:${server.address().port}/${token}`,mime:'video/mp4; codecs="avc1.42E01F,mp4a.40.2"'};}
  catch{await this.stop(id);throw Error('The local network decoder could not start.');}
 }
 async stop(id){const session=this.sessions.get(id);if(!session)return;if(session.stopping)return session.stopping;session.closing=true;
  session.stopping=(async()=>{session.response?.destroy();const child=session.child;if(child&&child.exitCode===null&&child.signalCode===null){await new Promise(resolve=>{const timer=setTimeout(()=>child.kill('SIGKILL'),3000);child.once('close',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});}await new Promise(resolve=>session.server?.listening?session.server.close(resolve):resolve());this.sessions.delete(id);})();return session.stopping;
 }
 async dispose(){await Promise.all([...this.sessions.keys()].map(id=>this.stop(id)));}
}
module.exports={NetworkInputs,validateNetworkUrl,inputArgs};
