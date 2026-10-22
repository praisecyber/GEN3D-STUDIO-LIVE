import React,{useEffect,useState} from 'react';
import {ProgramRecorder} from './recorder.mjs';
export function RecordingPanel({engine,mixer,notify,onStateChange}){
  const [controller,setController]=useState(null),[state,setState]=useState({phase:'idle',bytes:0,startedAt:0,error:'',filePath:''}),[now,setNow]=useState(Date.now());
  useEffect(()=>{if(!engine||!mixer)return;const recorder=new ProgramRecorder(engine.canvas,mixer,window.studio,next=>{setState(next);onStateChange(next);if(next.phase==='saved')notify('Recording saved: '+next.filePath);if(next.phase==='error')notify('Recording error: '+next.error);});setController(recorder);mixer.recordingController=recorder;
    const off=window.studio.onRecordingCloseRequested(async()=>{await Promise.all([recorder.stop(),mixer.streamingController?.stop()]);window.studio.recordingReadyToClose();});
    const timer=setInterval(()=>setNow(Date.now()),500);
    return()=>{off();clearInterval(timer);recorder.stop();};
  },[engine,mixer,notify,onStateChange]);
  const active=state.phase==='recording',busy=['choosing','stopping'].includes(state.phase);
  const elapsed=state.startedAt?Math.max(0,Math.floor(((state.stoppedAt||now)-state.startedAt)/1000)):0;
  const time=`${String(Math.floor(elapsed/3600)).padStart(2,'0')}:${String(Math.floor(elapsed/60)%60).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
  return <section className={`recording-section ${active?'is-recording':''}`} aria-label="Program recording"><div><span className="eyebrow">LOCAL CAPTURE</span><h2>Program Recording <span className="recording-phase">{state.phase}</span></h2><p>Save Program video and the Master audio mix to WebM. Recording follows Program even while Projection is on the projector.</p></div><div className="recording-controls"><output aria-label="Recording timer">{time}</output><span>{(state.bytes/1024/1024).toFixed(1)} MB written</span><button className={active?'stop-recording':'record-button'} disabled={!controller||busy} onClick={()=>active?controller.stop():controller.start()}>{active?'■ Stop recording':state.phase==='choosing'?'Choose save location…':state.phase==='stopping'?'Finishing file…':'● Start recording'}</button></div>
    {state.filePath&&<p className="recording-file">{state.phase==='saved'?'Saved: ':'Destination: '}{state.filePath}</p>}{state.error&&<p className="recording-error" role="alert">{state.error}</p>}
  </section>;
}
