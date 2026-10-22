// Program video and mixed audio travel locally over WebRTC; no cloud server or frame-by-frame IPC.
const programVideo = document.createElement('video');
programVideo.id='production-video'; programVideo.autoplay=true; programVideo.muted=true; programVideo.playsInline=true;
Object.assign(programVideo.style,{position:'fixed',inset:'0',width:'100%',height:'100%',objectFit:'contain',background:'#000',zIndex:'100',display:'none'});
document.body.append(programVideo);
const message=document.createElement('div');
Object.assign(message.style,{position:'fixed',inset:'0',zIndex:'101',display:'none',background:'#000',color:'#8994aa',alignItems:'center',justifyContent:'center',font:'20px sans-serif'});
message.textContent='Waiting for Live Production…'; document.body.append(message);
let peer=null, mode='projection', chain=Promise.resolve(), session=null;
const enableSound=document.createElement('button');enableSound.textContent='Enable Program audio';Object.assign(enableSound.style,{position:'fixed',bottom:'30px',left:'30px',zIndex:'102',display:'none',padding:'15px',font:'18px sans-serif'});document.body.append(enableSound);
enableSound.onclick=()=>{programVideo.muted=mode!=='production';programVideo.play().then(()=>enableSound.style.display='none').catch(console.error);};
function play(){programVideo.play().then(()=>enableSound.style.display='none').catch(()=>{enableSound.style.display=mode==='production'?'block':'none';});}
function show(){const production=mode==='production';programVideo.muted=!production||peer?.connectionState!=='connected';if(!production)enableSound.style.display='none';if(production&&peer?.connectionState==='connected')play();programVideo.style.display=production?'block':'none';message.style.display=production&&(!peer||peer.connectionState!=='connected')?'flex':'none';}
studio.onOutputMode(next=>{mode=next;show();});
studio.onVideoSignal(signal=>{
  chain=chain.then(async()=>{
    if(signal.type==='offer'){
      peer?.close(); const pc=new RTCPeerConnection({iceServers:[]});peer=pc;session=signal.session;const token=session;show();
      pc.onicecandidate=event=>{if(event.candidate)studio.sendVideoSignal({type:'candidate',session:token,candidate:event.candidate.toJSON()});};
      pc.onconnectionstatechange=()=>{if(pc===peer)show();};
      pc.ontrack=event=>{programVideo.srcObject=event.streams[0];play();};
      await pc.setRemoteDescription(signal.sdp);await pc.setLocalDescription(await pc.createAnswer());
      studio.sendVideoSignal({type:'answer',session:token,sdp:pc.localDescription.toJSON()}); show();
    }else if(signal.type==='candidate'&&signal.session===session&&peer)await peer.addIceCandidate(signal.candidate);
  }).catch(error=>{console.error('Video output',error);message.textContent='Video connection interrupted';show();});
});
studio.sendVideoSignal({type:'ready'});
window.addEventListener('beforeunload',()=>peer?.close());
