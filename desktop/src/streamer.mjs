import {recordingMime} from './recorder.mjs';
export class ProgramStreamer{
  constructor(canvas,mixer,bridge,onChange=()=>{}){this.canvas=canvas;this.mixer=mixer;this.bridge=bridge;this.onChange=onChange;this.state={phase:'idle',bytes:0,startedAt:0,stoppedAt:0,destinations:[],error:''};this.starting=null;this.done=null;this.session=null;this.off=bridge.onStreamStatus(status=>{if(status?.id!==this.session?.id)return;this.emit({destinations:status.destinations});if(status.phase==='error'&&this.state.phase==='streaming')this.fail(Error('All publishing destinations disconnected.'));});}
  emit(values={}){Object.assign(this.state,values);this.onChange({...this.state});}
  start(config){if(this.starting||['starting','streaming','stopping'].includes(this.state.phase))return this.starting||Promise.resolve();this.starting=this.begin(config).finally(()=>this.starting=null);return this.starting;}
  async begin(config){
    this.emit({phase:'starting',bytes:0,startedAt:0,stoppedAt:0,destinations:[],error:''});this.failure=null;this.queue=Promise.resolve();this.pending=0;this.done=null;this.session=null;this.stream=null;
    try{
      const mimeType=recordingMime();await this.mixer.enable();this.session=await this.bridge.startStream(config);
      this.stream=new MediaStream([...this.canvas.captureStream(30).getVideoTracks(),...this.mixer.destination.stream.getAudioTracks().map(t=>t.clone())]);
      this.recorder=new MediaRecorder(this.stream,{mimeType,videoBitsPerSecond:5_000_000,audioBitsPerSecond:160_000});
      this.done=new Promise(resolve=>this.resolveDone=resolve);
      this.recorder.ondataavailable=event=>{const blob=event.data;if(!blob.size||this.failure)return;this.pending+=blob.size;if(this.pending>16*1024*1024){this.fail(Error('The network or encoder cannot keep up. Streaming stopped.'));return;}this.queue=this.queue.then(async()=>{if(this.failure)return;await this.bridge.writeStream({id:this.session.id,chunk:await blob.arrayBuffer()});this.emit({bytes:this.state.bytes+blob.size});}).catch(e=>this.fail(e)).finally(()=>this.pending-=blob.size);};
      this.recorder.onerror=event=>this.fail(event.error||Error('Streaming capture failed.'));this.recorder.onstop=()=>this.finalize();
      this.recorder.start(250);this.emit({phase:'streaming',startedAt:Date.now(),destinations:this.session.destinations});
    }catch(error){if(this.session)await this.bridge.stopStream(this.session.id).catch(()=>{});this.release();this.emit({phase:'error',error:error.message});}
  }
  fail(error){this.failure ||= error;this.emit({error:this.failure.message});this.requestStop();}
  requestStop(){if(this.recorder&&this.recorder.state!=='inactive'){this.emit({phase:'stopping'});this.recorder.stop();}}
  async stop(){if(this.starting)await this.starting;this.requestStop();if(this.done)await this.done;return {...this.state};}
  async finalize(){this.emit({phase:'stopping',stoppedAt:Date.now()});try{await this.queue;const result=await this.bridge.stopStream(this.session.id);if(this.failure)throw this.failure;if(result.destinations.every(d=>d.status==='failed'))throw Error('Publishing ended with encoder errors. Check destination status.');this.emit({phase:'stopped',destinations:result.destinations});}catch(e){this.emit({phase:'error',error:e.message});}finally{this.release();this.resolveDone?.({...this.state});}}
  release(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
  async dispose(){await this.stop();this.off();}
}
