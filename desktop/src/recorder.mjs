export function recordingMime(Recorder=globalThis.MediaRecorder) {
  if(!Recorder)throw Error('Recording is unavailable in this Electron build.');
  for(const type of ['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'])if(Recorder.isTypeSupported(type))return type;
  throw Error('No supported WebM recording encoder is available.');
}
export class ProgramRecorder {
  constructor(canvas,mixer,bridge,onChange=()=>{}) {
    this.canvas=canvas;this.mixer=mixer;this.bridge=bridge;this.onChange=onChange;
    this.state={phase:'idle',bytes:0,startedAt:0,stoppedAt:0,filePath:'',error:''};this.starting=null;this.done=null;
  }
  emit(values={}){Object.assign(this.state,values);this.onChange({...this.state});}
  start(){if(this.starting||['recording','stopping','choosing'].includes(this.state.phase))return this.starting||Promise.resolve();this.starting=this.begin().finally(()=>this.starting=null);return this.starting;}
  async begin(){
    this.emit({phase:'choosing',bytes:0,error:'',filePath:'',startedAt:0,stoppedAt:0});this.done=null;this.resolveDone=null;this.failure=null;this.queue=Promise.resolve();this.pendingBytes=0;this.session=null;this.stream=null;this.recorder=null;
    try{
      const mimeType=recordingMime();await this.mixer.enable();
      const session=await this.bridge.beginRecording();
      if(session.canceled){this.emit({phase:'idle'});return;}
      this.session=session;
      const video=this.canvas.captureStream(30).getVideoTracks()[0];
      this.stream=new MediaStream([video,...this.mixer.destination.stream.getAudioTracks().map(t=>t.clone())]);
      this.recorder=new MediaRecorder(this.stream,{mimeType,videoBitsPerSecond:5_000_000,audioBitsPerSecond:160_000});
      this.done=new Promise(resolve=>this.resolveDone=resolve);
      this.recorder.ondataavailable=event=>{
        const blob=event.data;if(!blob.size||this.failure)return;
        this.pendingBytes+=blob.size;
        if(this.pendingBytes>64*1024*1024){this.fail(Error('The disk cannot keep up with recording.'));return;}
        this.queue=this.queue.then(async()=>{
          if(this.failure)return;
          const chunk=await blob.arrayBuffer();await this.bridge.writeRecording({id:session.id,chunk});
          this.emit({bytes:this.state.bytes+blob.size});
        }).catch(error=>this.fail(error)).finally(()=>this.pendingBytes-=blob.size);
      };
      this.recorder.onerror=event=>this.fail(event.error||Error('The recording encoder failed.'));
      this.recorder.onstop=()=>this.finalize();
      this.recorder.start(1000);this.emit({phase:'recording',startedAt:Date.now(),filePath:session.filePath});
    }catch(error){
      if(this.session){const partial=await this.bridge.abortRecording(this.session.id).catch(()=>null);if(partial?.partialPath)error=Error(`${error.message} Partial file: ${partial.partialPath}`);}
      this.release();this.emit({phase:'error',error:error.message});this.resolveDone?.({...this.state});
    }
  }
  fail(error){this.failure ||= error;this.emit({phase:'stopping',error:this.failure.message});this.requestStop();}
  requestStop(){if(this.recorder&&this.recorder.state!=='inactive'){this.emit({phase:'stopping'});this.recorder.stop();}}
  async stop(){if(this.starting)await this.starting;this.requestStop();if(this.done)await this.done;return {...this.state};}
  async finalize(){
    this.emit({phase:'stopping',stoppedAt:Date.now()});
    try{
      await this.queue;
      if(this.failure){const partial=await this.bridge.abortRecording(this.session.id);throw Error(`${this.failure.message} Partial file: ${partial.partialPath}`);}
      const saved=await this.bridge.finishRecording(this.session.id);this.emit({phase:'saved',filePath:saved.filePath,bytes:saved.bytes});
    }catch(error){await this.bridge.abortRecording(this.session.id).catch(()=>{});this.emit({phase:'error',error:error.message});}
    finally{this.release();this.resolveDone?.({...this.state});}
  }
  release(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
}
