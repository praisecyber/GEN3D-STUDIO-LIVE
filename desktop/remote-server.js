const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {WebSocketServer}=require('ws');
const {validateSongs}=require('./renderer/projection-library');
function createRemoteServer({port=8787,host,pin,clients=new Set(),getState,onCommand,onProgramSignal=()=>{}}){
 const programToken=randomUUID(),programPeers=new Map(),pinFailures=new Map();
 const assets=new Map([['/program',['program.html','text/html; charset=utf-8']],['/program-client.js',['program-client.js','text/javascript; charset=utf-8']],['/',['remote.html','text/html; charset=utf-8']],['/remote-client.js',['remote-client.js','text/javascript; charset=utf-8']],['/remote.css',['remote.css','text/css; charset=utf-8']]]);
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const requestUrl=new URL(req.url,'http://localhost');if(requestUrl.pathname==='/program'&&requestUrl.searchParams.get('token')!==programToken){res.writeHead(404);res.end();return;}
  const asset=assets.get(requestUrl.pathname);if(!asset){res.writeHead(404);res.end('Not found');return;}
  try{const body=await fs.readFile(path.join(__dirname,'renderer',asset[0]));res.setHeader('Content-Type',asset[1]);res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500);res.end('Remote interface unavailable');}
 });
 const wss=new WebSocketServer({server,maxPayload:65536});
 wss.on('connection',(ws,request)=>{
  ws.on('error',()=>{});const origin=request.headers.origin;if(origin!==undefined){try{const parsed=new URL(origin);if(!['http:','https:'].includes(parsed.protocol)||parsed.host.toLowerCase()!==String(request.headers.host).toLowerCase())throw Error();}catch{ws.close(1008,'Remote origin is not allowed');return;}}
  const requestUrl=new URL(request.url,'http://localhost'),viewer=requestUrl.pathname==='/program-ws',programId=randomUUID();
  let lastShare=0;
  let authed=viewer&&requestUrl.searchParams.get('token')===programToken;
  if(viewer&&!authed){ws.close(1008,'Invalid Program session');return;}
  if(viewer)programPeers.set(programId,ws);
  let programAttached=viewer;const timeout=setTimeout(()=>ws.close(1008,'Authentication required'),10000);timeout.unref();if(authed)clearTimeout(timeout);
  ws.on('message',raw=>{
   let message;try{message=JSON.parse(raw.toString());}catch{return;}
   if(!message||typeof message!=='object')return;
   if(!authed){const address=request.socket.remoteAddress||'unknown',now=Date.now();let attempts=pinFailures.get(address);if(!attempts||now-attempts.start>60000)attempts={start:now,count:0};if(attempts.count>=10){ws.close(1008,'Too many PIN attempts; wait one minute');return;}if(message.type!=='hello'||message.pin!==pin){attempts.count++;if(pinFailures.size>=1024)pinFailures.delete(pinFailures.keys().next().value);pinFailures.set(address,attempts);ws.close(1008,'Incorrect PIN');return;}pinFailures.delete(address);authed=true;clearTimeout(timeout);clients.add(ws);ws.send(JSON.stringify({type:'state',state:getState()}));return;}
   if(message.type==='video'&&message.signal&&['ready','answer','candidate','close'].includes(message.signal.type)){if(!programAttached){programAttached=true;programPeers.set(programId,ws);}onProgramSignal(programId,message.signal);return;}
   if(viewer||message.type!=='cmd')return;
   if(message.cmd==='shareSong'){
    if(Date.now()-lastShare<5000){ws.send(JSON.stringify({type:'songTransfer',error:'Wait five seconds between songs.'}));return;}
    try{const [song]=validateSongs([message.song]);if(Buffer.byteLength(JSON.stringify(song))>32000)throw Error();lastShare=Date.now();onCommand({cmd:'shareSong',song});ws.send(JSON.stringify({type:'songTransfer',ok:true}));}catch{ws.send(JSON.stringify({type:'songTransfer',error:'Song needs a title and lyrics, up to 32 KB.'}));}return;
   }
   if(message.cmd==='productionSelect'){if(typeof message.sourceId!=='string'||!getState()?.production?.sources?.some(source=>source.id===message.sourceId))return;}
   else if(message.cmd==='goto'){
    const {tab,item,slide}=message;if(!['songs','bible','media'].includes(tab)||!Number.isInteger(item)||!Number.isInteger(slide)||item<0||slide<0)return;
    const entry=getState()?.library?.find(entry=>entry.tab===tab&&entry.item===item);
    if(!entry||slide>=entry.slides.length)return;
   }else if(!['next','prev','take','clear','avatar','queueNext','queuePrev','queueLoad','productionCut','productionFade'].includes(message.cmd))return;
   onCommand(message);
  });
  ws.on('close',()=>{clearTimeout(timeout);clients.delete(ws);programPeers.delete(programId);if(programAttached)onProgramSignal(programId,{type:'close'});});
 });
 server.listen(port,host);
 return {server,wss,clients,programToken,sendProgramSignal:(id,signal)=>{const ws=programPeers.get(id);if(ws?.readyState===1)ws.send(JSON.stringify({type:'video',signal}));}};
}
module.exports={createRemoteServer};
