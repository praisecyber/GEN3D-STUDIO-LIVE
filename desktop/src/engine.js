import { BLACK, transition, advance, progress, removeSource,transitionRect } from './switcher.mjs';
import {defaultGraphics,fitRect,drawGraphics} from './graphics.mjs';
import {defaultComposition,normalizeComposition,pipRect,applyKey,removeCompositionSource} from './composition.mjs';
import {loadImage,waitForMedia} from './media.mjs';
export class VideoEngine {
  constructor(onChange, onError) {
    this.onChange = onChange; this.onError = onError;
    this.sources = new Map([[BLACK, { id: BLACK, name: 'Black', kind: 'black' }]]);
    this.state = { program: BLACK, preview: BLACK, fade: null };
    this.graphics={...defaultGraphics};this.composition={...defaultComposition};this.projectionText='';this.logoImage=null;this.logoRequest=0;
    this.canvas = document.createElement('canvas'); this.canvas.width = 1280; this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d', { alpha: false }); this.disposed = false;
    this.tick = now => {
      if (this.disposed) return;
      const next = advance(this.state, now);
      if (next !== this.state) { this.state = next; this.emit(); }
      this.renderProgram(now);this.mixer?.followProgram(this.state,now);
      this.frame = requestAnimationFrame(this.tick);
    };
    this.tick(performance.now());
  }
  emit() { this.onChange({ ...this.state, graphics:{...this.graphics},composition:{...this.composition},projectionText:this.projectionText,sources: [...this.sources.values()].map(({id,name,kind,playing,loop}) => ({id,name,kind,playing,loop})) }); }
  select(id) { if (!this.state.fade && this.sources.has(id)) { this.state = {...this.state, preview: id}; this.emit(); } }
  take(duration = 0,effect='fade') { this.state = transition(this.state, this.state.preview, duration, performance.now(),effect); this.emit(); }
  addPattern() {
    if (this.sources.size >= 9) throw Error('Eight input slots are already occupied.');
    const id = crypto.randomUUID();
    this.sources.set(id, { id, name: `Test pattern ${this.sources.size}`, kind: 'pattern', hue: this.sources.size * 67 }); this.emit();
  }
  attachMixer(mixer){this.mixer=mixer;}
  async addCamera(deviceId, name,withAudio=false) {
    this.checkSlot();
    if ([...this.sources.values()].some(s => s.deviceId === deviceId)) throw Error('This camera is already an input.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:withAudio,video:{deviceId:{exact:deviceId},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}}});
    return this.addStream(stream,name,'camera',{deviceId});
  }
  checkSlot(){if(this.disposed||this.sources.size>=9)throw Error('Eight input slots are already occupied or the switcher is closed.');}
  async addStream(stream,name,kind,extra={}){
    const video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;video.srcObject=stream;
    const id=crypto.randomUUID();
    try{await video.play();this.checkSlot();this.sources.set(id,{id,name,kind,video,stream,...extra});const source=this.sources.get(id);if(stream.getAudioTracks().length&&this.mixer)source.audioChannel=this.mixer.attachInput(id,name,stream);stream.getVideoTracks()[0].onended=()=>{this.remove(id);this.onError(`${name} ended. Affected monitors return to black.`);};this.emit();return id;}
    catch(error){this.sources.delete(id);video.pause();video.srcObject=null;stream.getTracks().forEach(t=>t.stop());throw error;}
  }
  async addDisplay(source){
    this.checkSlot();
    if([...this.sources.values()].some(s=>s.captureId===source.id))throw Error('This screen or window is already an input.');
    await window.studio.selectCaptureSource(source.id);
    const stream=await navigator.mediaDevices.getDisplayMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}}});
    return this.addStream(stream,source.name,'screen',{captureId:source.id});
  }
  async addMedia(file){
    this.checkSlot();const id=crypto.randomUUID();
    if(file.type==='image'){const image=await loadImage(file.url);this.checkSlot();this.sources.set(id,{id,name:file.name,kind:'image',image});}
    else if(file.type==='video'){
      const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
      const loaded=waitForMedia(video,'loadeddata',()=>video.readyState>=2);video.src=file.url;
      try{await loaded;this.checkSlot();this.sources.set(id,{id,name:file.name,kind:'video',video,playing:false,loop:false});if(this.mixer){const channel=this.mixer.attachInput(id,file.name,video);this.sources.get(id).audioChannel=channel;video.muted=false;}
        video.onended=()=>{const s=this.sources.get(id);if(s){s.playing=false;this.emit();}};
        video.onerror=()=>{this.remove(id);this.onError(`${file.name} became unavailable and was removed.`);};
      }catch(error){this.sources.delete(id);video.removeAttribute('src');video.load();throw error;}
    }else throw Error('Choose an image or video for the production input.');
    this.emit();return id;
  }
  async toggleMedia(id){const s=this.sources.get(id);if(s?.kind!=='video')return;if(s.video.paused){await s.video.play();s.playing=true;}else{s.video.pause();s.playing=false;}this.emit();}
  async restartMedia(id){const s=this.sources.get(id);if(s?.kind!=='video')return;s.video.currentTime=0;await s.video.play();s.playing=true;this.emit();}
  setLoop(id,loop){const s=this.sources.get(id);if(s?.kind!=='video')return;s.loop=!!loop;s.video.loop=!!loop;this.emit();}
  async addBrowser(url,name){this.checkSlot();const session=await window.studio.startBrowserInput(url),id=crypto.randomUUID();try{this.checkSlot();this.sources.set(id,{id,name:name||'Browser',kind:'browser',browserId:session.id,cleanup:()=>window.studio.stopBrowserInput(session.id).catch(()=>{})});this.emit();return id;}catch(error){await window.studio.stopBrowserInput(session.id);throw error;}}
  async browserFrame(frame){const source=[...this.sources.values()].find(s=>s.browserId===frame.id);if(!source||source.decoding)return;source.decoding=true;try{const bitmap=await createImageBitmap(new Blob([frame.data],{type:'image/jpeg'}));if(this.sources.has(source.id)){source.image?.close?.();source.image=bitmap;}else bitmap.close();}catch{}finally{source.decoding=false;}}
  async addNdi(sourceId,name){return this.addNetwork(null,name,sourceId);}
  async addNetwork(url,name,ndiSourceId){
    this.checkSlot();const session=ndiSourceId?await window.studio.startNdiInput(ndiSourceId):await window.studio.startNetworkInput(url),id=crypto.randomUUID(),video=document.createElement('video'),media=new MediaSource(),abort=new AbortController();
    video.muted=true;video.playsInline=true;const objectUrl=URL.createObjectURL(media);video.src=objectUrl;
    const cleanup=()=>{abort.abort();URL.revokeObjectURL(objectUrl);void (ndiSourceId?window.studio.stopNdiInput(session.id):window.studio.stopNetworkInput(session.id)).catch(()=>{});};
    const append=(buffer,data)=>new Promise((resolve,reject)=>{const done=()=>{clear();resolve();},fail=()=>{clear();reject(Error('Network stream decoding failed.'));},clear=()=>{buffer.removeEventListener('updateend',done);buffer.removeEventListener('error',fail);buffer.removeEventListener('abort',fail);};buffer.addEventListener('updateend',done,{once:true});buffer.addEventListener('error',fail,{once:true});buffer.addEventListener('abort',fail,{once:true});try{buffer.appendBuffer(data);}catch(error){clear();reject(error);}});
    const pump=async()=>{try{if(!MediaSource.isTypeSupported(session.mime))throw Error('This browser does not support the network decoder format.');await new Promise((resolve,reject)=>{media.addEventListener('sourceopen',resolve,{once:true});abort.signal.addEventListener('abort',()=>reject(Error('Network input closed.')),{once:true});});const buffer=media.addSourceBuffer(session.mime),response=await fetch(session.url,{signal:abort.signal});if(!response.ok)throw Error('Network decoder unavailable.');const reader=response.body.getReader();while(!abort.signal.aborted){const {done,value}=await reader.read();if(done)break;await append(buffer,value);if(video.readyState<2&&buffer.buffered.length&&video.currentTime<buffer.buffered.start(0))video.currentTime=buffer.buffered.start(0);if(buffer.buffered.length&&video.currentTime-buffer.buffered.start(0)>20){await new Promise(resolve=>{buffer.addEventListener('updateend',resolve,{once:true});buffer.remove(0,video.currentTime-10);});}}if(media.readyState==='open'&&!buffer.updating)media.endOfStream();}catch(error){if(!abort.signal.aborted){this.remove(id);cleanup();this.onError(ndiSourceId?'NDI input ended or could not decode. Check the sender, runtime and FFmpeg build.':'Network input ended or could not decode. Check the URL, transport and FFmpeg build.');}}};
    const ready=waitForMedia(video,'loadeddata',()=>video.readyState>=2);void pump();
    try{await ready;await video.play();this.checkSlot();const source={id,name:name||'Network input',kind:'network',video,cleanup};this.sources.set(id,source);if(this.mixer){source.audioChannel=this.mixer.attachInput(id,source.name,video);video.muted=false;}this.emit();return id;}catch(error){if(ndiSourceId)console.error('NDI startup',error.message,video.error?.code,video.readyState,video.buffered.length?[video.buffered.start(0),video.buffered.end(0)]:[]);this.sources.delete(id);cleanup();video.pause();video.removeAttribute('src');video.load();throw Error(ndiSourceId?'NDI input could not start. Check the sender, installed runtime and FFmpeg.':'Network input could not start. Check the stream and FFmpeg configuration.');}
  }
  setGraphics(patch){this.graphics={...this.graphics,...patch,title:String(patch.title??this.graphics.title).slice(0,200),subtitle:String(patch.subtitle??this.graphics.subtitle).slice(0,300)};this.emit();}
  setComposition(patch){this.composition=normalizeComposition({...this.composition,...patch});if(!this.sources.has(this.composition.pipSource))this.composition.pipEnabled=false;if(!this.sources.has(this.composition.keySource))this.composition.keyEnabled=false;this.emit();}
  setProjection(state){const text=String(state?.liveText||'').slice(0,8000);if(text!==this.projectionText){this.projectionText=text;this.emit();}}
  async setLogo(file){const request=++this.logoRequest;this.setGraphics({logoEnabled:false});const image=await loadImage(file.url);if(this.disposed||request!==this.logoRequest)return;this.logoImage=image;this.setGraphics({logoName:file.name});}
  clearLogo(){this.logoRequest++;this.logoImage=null;this.setGraphics({logoEnabled:false,logoName:''});}
  hideGraphics(){this.setGraphics({lowerThirdEnabled:false,lyricsEnabled:false,logoEnabled:false});}
  remove(id) {
    if (id === BLACK) return;
    const source = this.sources.get(id);
    if(source?.audioChannel)this.mixer?.remove(source.audioChannel);source?.cleanup?.();
    source?.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    if (source?.video) { source.video.onended=null;source.video.onerror=null;source.video.pause();source.video.srcObject=null;source.video.removeAttribute('src');source.video.load(); }
    source?.image?.close?.();this.sources.delete(id);this.composition=removeCompositionSource(this.composition,id); this.state = removeSource(this.state, id); this.emit();
  }
  draw(ctx, id, now, transparent=false) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if(transparent)ctx.clearRect(0,0,w,h);else{ctx.fillStyle = '#000';ctx.fillRect(0,0,w,h);}
    const s = this.sources.get(id);
    if (!s) return;
    if (s.video && s.video.readyState >= 2 && s.video.videoWidth) {
      const box=fitRect(s.video.videoWidth,s.video.videoHeight,w,h);ctx.drawImage(s.video,box.x,box.y,box.width,box.height);
    } else if(s.image&&(s.image.naturalWidth||s.image.width)){const box=fitRect(s.image.naturalWidth||s.image.width,s.image.naturalHeight||s.image.height,w,h);ctx.drawImage(s.image,box.x,box.y,box.width,box.height);
    } else if (s.kind === 'pattern') {
      const colors = ['#ddd','#d6c92c','#38b7bc','#42ad63','#b850b0','#bc4545','#3456b9'];
      colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i*w/7,0,w/7+1,h); });
      ctx.fillStyle = `hsl(${s.hue} 45% 18% / .92)`; ctx.fillRect(0,h*.63,w,h*.37);
      ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(w/23)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(s.name,w/2,h*.76); ctx.font = `${Math.round(w/36)}px monospace`;
      ctx.fillText((now/1000).toFixed(1)+' s · GEN3D LIVE',w/2,h*.87);
    }
  }
  renderProgram(now) {
    const f = this.state.fade;
    this.draw(this.ctx, f ? f.from : this.state.program, now);
    if (f) {
      if (!this.mix) { this.mix = document.createElement('canvas'); this.mix.width=1280; this.mix.height=720; }
      this.draw(this.mix.getContext('2d'), f.to, now);
      const p=progress(f,now),effect=f.effect||'fade';this.ctx.save();
      if(effect==='wipe'){this.ctx.beginPath();this.ctx.rect(0,0,this.canvas.width*p,this.canvas.height);this.ctx.clip();}
      if(effect==='fade')this.ctx.globalAlpha=p;
      const box=transitionRect(effect,p,this.canvas.width,this.canvas.height);if(box.width&&box.height)this.ctx.drawImage(this.mix,box.x,box.y,box.width,box.height);this.ctx.restore();
    }
    this.renderComposition(now);
    drawGraphics(this.ctx,this.graphics,this.projectionText,this.logoImage);
  }
  renderComposition(now){
    const c=this.composition;
    if(c.keyEnabled&&this.sources.has(c.keySource)){
      try{
        if(!this.keyLayer){this.keyLayer=document.createElement('canvas');this.keyLayer.width=640;this.keyLayer.height=360;this.keyContext=this.keyLayer.getContext('2d',{willReadFrequently:true});}
        this.draw(this.keyContext,c.keySource,now,true);const frame=this.keyContext.getImageData(0,0,640,360);applyKey(frame.data,c);this.keyContext.putImageData(frame,0,0);this.ctx.drawImage(this.keyLayer,0,0,this.canvas.width,this.canvas.height);
      }catch(error){this.composition.keyEnabled=false;this.emit();this.onError('Keyer disabled: '+error.message);}
    }
    if(c.pipEnabled&&this.sources.has(c.pipSource)){
      if(!this.pipLayer){this.pipLayer=document.createElement('canvas');this.pipLayer.width=640;this.pipLayer.height=360;}
      this.draw(this.pipLayer.getContext('2d'),c.pipSource,now);const box=pipRect(this.canvas.width,this.canvas.height,c.pipScale,c.pipCorner);this.ctx.save();this.ctx.fillStyle='#9fb8d9';this.ctx.fillRect(box.x-2,box.y-2,box.width+4,box.height+4);this.ctx.drawImage(this.pipLayer,box.x,box.y,box.width,box.height);this.ctx.restore();
    }
  }
  dispose() { this.disposed=true; cancelAnimationFrame(this.frame); [...this.sources.keys()].forEach(id => this.remove(id)); }
}
