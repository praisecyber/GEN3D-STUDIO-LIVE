import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VideoEngine } from './engine';
import './style.css';
import { AudioMixer } from './audio.mjs';
import { AudioPanel } from './AudioPanel';
import { RecordingPanel } from './RecordingPanel';
import { StreamingPanel } from './StreamingPanel';
import {SourceTools} from './SourceTools';
import {OverlayPanel} from './OverlayPanel';
import {CompositionPanel} from './CompositionPanel';

function Monitor({ engine, source, program, label, small=false }) {
  const ref = useRef();
  useEffect(() => {
    if (!engine) return;
    const ctx = ref.current.getContext('2d'); let frame;
    const draw = now => {
      if(program) ctx.drawImage(engine.canvas,0,0,ref.current.width,ref.current.height);
      else engine.draw(ctx,source,now);
      frame = requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [engine, source, program]);
  return <div className={`monitor ${small?'small':''}`}><canvas ref={ref} width={small?320:640} height={small?180:360} aria-label={label}/></div>;
}

function App() {
  const [workspace, setWorkspace] = useState('projection');
  const [snapshot,setSnapshot] = useState({sources:[],program:'black',preview:'black',fade:null});
  const [engine,setEngine] = useState(null);
  const [mixer,setMixer] = useState(null);
  const [recordingState,setRecordingState]=useState({phase:'idle'});
  const [streamState,setStreamState]=useState({phase:'idle'});
  const [devices,setDevices] = useState([]), [camera,setCamera] = useState('');
  const [busy,setBusy] = useState(false), [notice,setNotice] = useState('Ready. Select an input for Preview, then Cut or Fade to Program.');
  const [duration,setDuration] = useState(700), [mode,setMode] = useState('projection');
  const [link,setLink] = useState('Connecting output…'); const [info,setInfo] = useState(null);
  const [seconds,setSeconds] = useState(0);
  useEffect(() => {const t=setInterval(()=>setSeconds(v=>v+1),1000);return()=>clearInterval(t);},[]);
  useEffect(() => {
    const audio=new AudioMixer(()=>{},setNotice);setMixer(audio);
    const e = new VideoEngine(setSnapshot,setNotice); setEngine(e); e.emit();
    let peer=null, feed=null, disposed=false, retry=null, session=null, timeout=null;
    let chain=Promise.resolve();
    async function connect() {
      if(disposed) return;
      clearTimeout(timeout); peer?.close(); const pc=new RTCPeerConnection({iceServers:[]}); peer=pc;
      const token=crypto.randomUUID(); session=token;
      setLink('Connecting output…');
      timeout=setTimeout(()=>{if(pc===peer&&pc.connectionState!=='connected')setLink('Output not connected. Use Reconnect output.');},10000);
      feed ||= new MediaStream([...e.canvas.captureStream(30).getVideoTracks(),...audio.destination.stream.getAudioTracks()]);
      feed.getTracks().forEach(track=>pc.addTrack(track,feed));
      pc.onicecandidate=event=>{if(event.candidate) window.studio.sendVideoSignal({type:'candidate',session:token,candidate:event.candidate.toJSON()});};
      pc.onconnectionstatechange=()=>{
        if (pc !== peer || disposed) return;
        if (pc.connectionState==='connected') clearTimeout(timeout);
        setLink(pc.connectionState==='connected'?'Program A/V connected':`Output: ${pc.connectionState}`);
        if (['failed','disconnected'].includes(pc.connectionState)) {
          clearTimeout(retry); retry=setTimeout(()=>window.studio.requestVideoOutput(),1500);
        }
      };
      await pc.setLocalDescription(await pc.createOffer());
      if(pc===peer&&!disposed) window.studio.sendVideoSignal({type:'offer',session:token,sdp:pc.localDescription.toJSON()});
    }
    const off=window.studio.onVideoSignal(message=>{
      chain=chain.then(async()=>{
        if(disposed) return;
        if(message.type==='ready') await connect();
        else if(message.type==='answer'&&message.session===session&&peer) await peer.setRemoteDescription(message.sdp);
        else if(message.type==='candidate'&&message.session===session&&peer) await peer.addIceCandidate(message.candidate);
      }).catch(error=>setLink('Output connection error: '+error.message));
    });
    const offMode=window.studio.onOutputMode(setMode);
    const offProjection=window.studio.onProjectionState(state=>e.setProjection(state));window.studio.requestProjectionState();
    window.studio.requestVideoOutput();
    window.studio.info().then(setInfo).catch(()=>{});
    async function refresh(){try {const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');setDevices(list);setCamera(v=>list.some(d=>d.deviceId===v)?v:list[0]?.deviceId||'');}catch(err){setNotice(err.message);}}
    refresh(); navigator.mediaDevices.addEventListener('devicechange',refresh);
    const cleanup=event=>{if(event?.type==='beforeunload'&&(['choosing','recording','stopping'].includes(audio.recordingController?.state.phase)||['starting','streaming','stopping'].includes(audio.streamingController?.state.phase))){event.preventDefault();event.returnValue='';Promise.all([audio.recordingController?.stop(),audio.streamingController?.stop()]).then(()=>window.location.reload());return;}disposed=true;clearTimeout(retry);clearTimeout(timeout);off();offMode();offProjection();peer?.close();feed?.getTracks().forEach(t=>t.stop());e.dispose();audio.dispose();};
    window.addEventListener('beforeunload',cleanup,{once:true});
    return ()=>{navigator.mediaDevices.removeEventListener('devicechange',refresh);window.removeEventListener('beforeunload',cleanup);cleanup();};
  },[]);
  const name=id=>snapshot.sources.find(s=>s.id===id)?.name||'Black';
  async function refreshCameras(){try {if (!devices.length || devices.some(d=>!d.deviceId || !d.label)) { const permissionStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});permissionStream.getTracks().forEach(t=>t.stop()); } const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');setDevices(list);setCamera(list[0]?.deviceId||'');setNotice(list.length?`${list.length} camera(s) found.`:'No camera detected. Connect a webcam or USB capture device, then refresh.');}catch(e){setNotice(e.message);}}
  async function addCamera(){if(!camera||!engine)return;setBusy(true);try{const d=devices.find(d=>d.deviceId===camera);await engine.addCamera(camera,d?.label||`Camera ${devices.indexOf(d)+1}`);setNotice('Camera added. Select its tile to preview.');await refreshCameras();}catch(e){setNotice('Camera unavailable: '+e.message+' Check Windows camera permissions and whether another app is using it.');}finally{setBusy(false);}}
  function take(ms){if(engine){engine.take(ms);setNotice(ms?`Fading to ${name(snapshot.preview)}…`:`Cut to ${name(snapshot.preview)}.`);}}
  function output(next){window.studio.setOutputMode(next);setMode(next);setNotice(next==='production'?'Live Production Program is now on the projector.':'Projection Studio is now on the projector.');}
  const fading=!!snapshot.fade;
  return <div className="app">
    <header><div className="brand"><div className="brandmark">G</div><div>GEN3D <strong>STUDIO LIVE</strong><small>PROJECTION / PRODUCTION</small></div></div><div className="header-right">{['streaming','stopping'].includes(streamState.phase)&&<button className="stream-indicator" aria-label="Stop active Program stream" disabled={streamState.phase==='stopping'} onClick={()=>mixer?.streamingController?.stop()}>{streamState.phase==='streaming'?'● STREAM · STOP':'STOPPING STREAM…'}</button>}{['recording','stopping'].includes(recordingState.phase)&&<button className="recording-indicator" aria-label="Stop active Program recording" disabled={recordingState.phase==='stopping'} onClick={()=>mixer?.recordingController?.stop()}>{recordingState.phase==='recording'?'● REC · STOP':'SAVING RECORDING…'}</button>}<span className="session">LOCAL SESSION · {String(Math.floor(seconds/3600)).padStart(2,'0')}:{String(Math.floor(seconds/60)%60).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span><span className="version">v17 · PiP & keying</span></div></header>
    <nav><button className={workspace==='projection'?'selected':''} onClick={()=>setWorkspace('projection')}>01 <b>Projection Studio</b></button><button className={workspace==='production'?'selected':''} onClick={()=>setWorkspace('production')}>02 <b>Live Production</b></button><button className={workspace==='streaming'?'selected':''} onClick={()=>setWorkspace('streaming')}>03 <b>Streaming</b></button><div className="nav-output">PROJECTOR <strong className={mode==='production'?'red-text':'green-text'}>{mode==='production'?'PROGRAM':'PROJECTION'}</strong></div></nav>
    <section className="projection" hidden={workspace!=='projection'}><div className="projection-toolbar"><span>Lyrics, Bible, media, stage display &amp; AI assistant</span><button onClick={()=>output('projection')} disabled={mode==='projection'}>Send Projection to projector</button></div><iframe src="./operator.html" title="Existing Projection Studio"/></section>
    <main hidden={workspace!=='production'}>
      <div className="title-row"><div><span className="eyebrow">CONTROL ROOM</span><h1>Live Production</h1><p>Prepare in Preview. Take to Program. Control what your audience sees.</p></div><div className="output-controls"><button onClick={()=>window.studio.requestVideoOutput()}>Reconnect output</button><button onClick={()=>output('projection')} disabled={mode==='projection'}>Projection output</button><button className={mode==='production'?'live-button active':'live-button'} onClick={()=>output('production')} disabled={mode==='production'}>{mode==='production'?'● Program on projector':'Send Program to projector'}</button></div></div>
      <div className="monitors"><section className="monitor-panel preview"><div className="panel-label"><span><i/> PREVIEW</span><b>{name(snapshot.preview)}</b></div><Monitor engine={engine} source={snapshot.preview} label="Preview monitor"/><div className="monitor-foot">NEXT SOURCE <span>1280 × 720 · mixed audio</span></div></section><section className="monitor-panel program"><div className="panel-label"><span><i/> PROGRAM</span><b>{fading?`${name(snapshot.fade.from)} → ${name(snapshot.fade.to)}`:name(snapshot.program)}</b></div><Monitor engine={engine} program label="Program monitor"/><div className="monitor-foot">{mode==='production'?'ON PROJECTOR':'INTERNAL PROGRAM'}<span>{link}</span></div></section></div>
      <section className="transition-bar"><div><span className="eyebrow">TRANSITION</span><p>{fading?'Transition in progress…':'Preview and Program swap after each transition.'}</p></div><label>Fade duration <select value={duration} onChange={e=>setDuration(Number(e.target.value))} disabled={fading}><option value={300}>0.3 seconds</option><option value={700}>0.7 seconds</option><option value={1000}>1 second</option><option value={2000}>2 seconds</option></select></label><button className="cut" disabled={fading||snapshot.preview===snapshot.program} onClick={()=>take(0)}>CUT</button><button className="fade" disabled={fading||snapshot.preview===snapshot.program} onClick={()=>take(duration)}>{fading?'FADING…':'FADE →'}</button></section>
      <section className="input-section"><div className="input-header"><div><span className="eyebrow">SOURCE DECK</span><h2>Inputs <span>{Math.max(0,snapshot.sources.length-1)} / 8</span></h2></div><div className="camera-controls"><select aria-label="Camera device" value={camera} onChange={e=>setCamera(e.target.value)} disabled={busy}><option value="">Select camera…</option>{devices.map((d,i)=><option key={d.deviceId||i} value={d.deviceId}>{d.label||`Camera ${i+1}`}</option>)}</select><button onClick={refreshCameras} disabled={busy}>Enable / refresh</button><button className="primary" onClick={addCamera} disabled={busy||!camera||snapshot.sources.length>=9}>{busy?'Opening…':'+ Add camera'}</button><button onClick={()=>{try{engine.addPattern();setNotice('Test pattern added. Select it, then Cut or Fade.');}catch(e){setNotice(e.message);}}} disabled={!engine||snapshot.sources.length>=9}>+ Test pattern</button></div></div>
      <SourceTools engine={engine} full={snapshot.sources.length>=9} notify={setNotice}/><div className="sources">{snapshot.sources.map((source,i)=><article key={source.id} className={`source ${snapshot.preview===source.id?'is-preview':''} ${snapshot.program===source.id?'is-program':''}`}><button className="source-select" disabled={fading} onClick={()=>engine.select(source.id)} aria-label={`Preview ${source.name}`}><Monitor engine={engine} source={source.id} small label={source.name}/><div className="source-info"><span className="source-number">{String(i).padStart(2,'0')}</span><b>{source.name}</b><span>{snapshot.program===source.id?'PGM':snapshot.preview===source.id?'PVW':source.kind.toUpperCase()}</span></div></button>{source.kind==='video'&&<div className="video-source-controls"><button aria-label={`${source.playing?'Pause':'Play'} video ${source.name}`} onClick={()=>engine.toggleMedia(source.id).catch(e=>setNotice(e.message))}>{source.playing?'Pause':'Play'}</button><button aria-label={`Restart video ${source.name}`} onClick={()=>engine.restartMedia(source.id).catch(e=>setNotice(e.message))}>Restart</button><label><input aria-label={`Loop video ${source.name}`} type="checkbox" checked={!!source.loop} onChange={e=>engine.setLoop(source.id,e.target.checked)}/>Loop</label></div>}{source.id!=='black'&&<button className="remove" onClick={()=>engine.remove(source.id)} aria-label={`Remove ${source.name}`}>×</button>}</article>)}{snapshot.sources.length===1&&<div className="empty-input"><strong>Your sources go here</strong><p>Add a webcam or a test pattern to try the switcher.<br/>Compatible USB capture devices appear as cameras.</p></div>}</div></section>
      <CompositionPanel engine={engine} snapshot={snapshot}/><OverlayPanel engine={engine} snapshot={snapshot} notify={setNotice}/><RecordingPanel engine={engine} mixer={mixer} notify={setNotice} onStateChange={setRecordingState}/><AudioPanel mixer={mixer} notify={setNotice}/><aside className="scope-note"><strong>Production MVP</strong> Camera, screen and media switching, PiP/keying, Program overlays, microphone/file audio mixing, local Program recording, RTMP/RTMPS publishing and Program routing are implemented. SRT, NDI, ISO recording and virtual camera are future modules.</aside>
    </main><main hidden={workspace!=='streaming'}><StreamingPanel engine={engine} mixer={mixer} notify={setNotice} onStateChange={setStreamState} monitor={<Monitor engine={engine} program label="Streaming Program monitor"/>}/></main><footer><span role="status">{notice}</span><span>{info?`REMOTE ${info.ip}:${info.port}`:'DESKTOP SESSION'}</span></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
