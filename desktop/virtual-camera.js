const {OBSWebSocket}=require('obs-websocket-js');
class VirtualCamera{
 constructor(Client=OBSWebSocket){this.Client=Client;this.client=null;this.active=false;this.busy=false;}
 async request(name,params){let timer;try{return await Promise.race([this.client.call(name,params),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('OBS request timed out.')),8000))]);}finally{clearTimeout(timer);}}
 async start(programUrl,password=''){
  if(this.busy||this.active)throw Error('Virtual camera is already active or starting.');this.busy=true;this.previousScene=null;let changedScene=false;
  try{this.client=new this.Client();await this.client.connect('ws://127.0.0.1:4455',String(password),{rpcVersion:1});
   const [stream,record,camera]=await Promise.all([this.request('GetStreamStatus'),this.request('GetRecordStatus'),this.request('GetVirtualCamStatus')]);
   if(stream.outputActive||record.outputActive||camera.outputActive)throw Error('Stop OBS streaming, recording and Virtual Camera before connecting GEN3D.');
   this.previousScene=(await this.request('GetCurrentProgramScene')).currentProgramSceneName;
   const scene='GEN3D Virtual Camera',input='GEN3D Program (managed)',scenes=await this.request('GetSceneList');if(!scenes.scenes.some(s=>s.sceneName===scene))await this.request('CreateScene',{sceneName:scene});
   const inputs=await this.request('GetInputList');const existing=inputs.inputs.find(i=>i.inputName===input);if(existing&&existing.inputKind!=='browser_source')throw Error('An incompatible OBS input already uses the managed GEN3D name.');
   const settings={url:programUrl,width:1280,height:720,fps:30,reroute_audio:true,shutdown:true};
   if(existing){await this.request('SetInputSettings',{inputName:input,inputSettings:settings,overlay:true});const items=await this.request('GetSceneItemList',{sceneName:scene});if(!items.sceneItems.some(item=>item.sourceName===input))await this.request('CreateSceneItem',{sceneName:scene,sourceName:input,sceneItemEnabled:true});}
   else await this.request('CreateInput',{sceneName:scene,inputName:input,inputKind:'browser_source',inputSettings:settings,sceneItemEnabled:true});
   await this.request('SetCurrentProgramScene',{sceneName:scene});changedScene=true;await this.request('StartVirtualCam');this.active=true;return {active:true,device:'OBS Virtual Camera'};
  }catch(error){if(changedScene&&this.previousScene)await this.request('SetCurrentProgramScene',{sceneName:this.previousScene}).catch(()=>{});await this.client?.disconnect().catch(()=>{});this.client=null;throw Error(error.message?.startsWith('Stop OBS')||error.message?.startsWith('An incompatible')?error.message:'Could not start Virtual Camera. Install OBS Studio, enable WebSocket server on port 4455, and check its password.');}finally{this.busy=false;}
 }
 async stop(){if(!this.client)return {active:false};try{if(this.active){await this.request('StopVirtualCam');await this.request('SetInputSettings',{inputName:'GEN3D Program (managed)',inputSettings:{url:'about:blank'},overlay:true});const current=await this.request('GetCurrentProgramScene');if(current.currentProgramSceneName==='GEN3D Virtual Camera'&&this.previousScene)await this.request('SetCurrentProgramScene',{sceneName:this.previousScene});}this.active=false;return {active:false};}finally{this.active=false;await this.client.disconnect().catch(()=>{});this.client=null;}}
}
module.exports={VirtualCamera};
