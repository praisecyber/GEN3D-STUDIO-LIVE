window.createProgramReceiver=function(video,send,status){
 let peer=null,session=null,chain=Promise.resolve();
 function stop(){peer?.close();peer=null;video.srcObject?.getTracks().forEach(track=>track.stop());video.srcObject=null;}
 return {receive(signal){chain=chain.then(async()=>{if(signal.type==='offer'){stop();session=signal.session;const pc=new RTCPeerConnection({iceServers:[]});peer=pc;pc.onicecandidate=event=>{if(event.candidate)send({type:'candidate',session,candidate:event.candidate.toJSON()});};pc.ontrack=event=>{video.srcObject=event.streams[0];video.play().catch(()=>status('Press Play to view Program.'));};pc.onconnectionstatechange=()=>{if(pc!==peer)return;status('Program: '+pc.connectionState);if(['failed','disconnected','closed'].includes(pc.connectionState)){video.srcObject=null;}};await pc.setRemoteDescription(signal.sdp);await pc.setLocalDescription(await pc.createAnswer());send({type:'answer',session,sdp:pc.localDescription.toJSON()});}else if(signal.type==='candidate'&&signal.session===session&&peer)await peer.addIceCandidate(signal.candidate);}).catch(()=>status('Program connection failed. Reconnect to try again.'));},stop(){send({type:'close'});stop();}};
};
if(document.body.dataset.programViewer){
 const video=document.getElementById('program'),status=document.getElementById('programStatus'),token=new URLSearchParams(location.search).get('token');
 const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/program-ws?token=${encodeURIComponent(token||'')}`);
 const receiver=createProgramReceiver(video,signal=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'video',signal}));},text=>status.textContent=text);
 socket.onopen=()=>socket.send(JSON.stringify({type:'video',signal:{type:'ready'}}));socket.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.type==='video')receiver.receive(message.signal);}catch{}};socket.onclose=()=>{receiver.stop();status.textContent='Program disconnected';};
}
