export const clampGain = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
export function levelDb(samples) {
  let peak=0; for (const value of samples) peak=Math.max(peak,Math.abs(value));
  return peak > 0 ? Math.max(-60,20*Math.log10(peak)) : -60;
}
export function setGain(node, value, muted, context) {
  node.gain.setTargetAtTime(muted?0:clampGain(value),context.currentTime,0.015);
}
export class AudioMixer {
  constructor(onChange=()=>{}, onError=()=>{}) {
    this.context=new AudioContext();this.channels=new Map();this.onChange=onChange;this.onError=onError;this.disposed=false;
    this.master={volume:0.8,muted:true};
    this.masterGain=this.context.createGain();this.masterGain.gain.value=0;
    this.masterMeter=this.context.createAnalyser();this.masterMeter.fftSize=512;
    this.destination=this.context.createMediaStreamDestination();
    this.context.onstatechange=()=>this.emit();
    this.masterGain.connect(this.masterMeter);this.masterMeter.connect(this.destination);
    // No connection to context.destination: the operator never monitors microphones on speakers.
  }
  snapshot(){return {status:this.context.state,master:{...this.master},channels:[...this.channels.values()].map(({id,name,kind,volume,muted,playing})=>({id,name,kind,volume,muted,playing}))};}
  emit(){if(!this.disposed)this.onChange(this.snapshot());}
  async enable(){if(this.disposed)throw Error('Mixer closed.');await this.context.resume();this.emit();}
  setMaster(volume,muted){this.master={volume:clampGain(volume),muted:!!muted};setGain(this.masterGain,this.master.volume,this.master.muted,this.context);this.emit();}
  setChannel(id,volume,muted){const c=this.channels.get(id);if(!c)return;c.volume=clampGain(volume);c.muted=!!muted;setGain(c.gain,c.volume,c.muted,this.context);this.emit();}
  attach(name,kind,source,extra={}){
    if(this.disposed||this.channels.size>=8)throw Error('Eight audio channels are already occupied or the mixer is closed.');
    const id=crypto.randomUUID(),gain=this.context.createGain(),analyser=this.context.createAnalyser();
    gain.gain.value=0;analyser.fftSize=512;source.connect(gain);gain.connect(analyser);analyser.connect(this.masterGain);
    this.channels.set(id,{id,name,kind,source,gain,analyser,volume:.75,muted:true,playing:kind!=='file',...extra});this.emit();return id;
  }
  async addMicrophone(deviceId,name){
    if(this.channels.size>=8)throw Error('Eight audio channels are already occupied.');
    if([...this.channels.values()].some(c=>c.deviceId===deviceId))throw Error('This microphone is already in the mixer.');
    await this.enable();
    const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{deviceId:{exact:deviceId},echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
    try {
      const source=this.context.createMediaStreamSource(stream);let id;
      try{id=this.attach(name,'microphone',source,{stream,deviceId});}catch(e){source.disconnect();throw e;}
      stream.getAudioTracks()[0].onended=()=>{this.remove(id);this.onError(`${name} disconnected. Its audio channel was removed.`);};return id;
    }catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
  }
  async addTone(){await this.enable();const source=this.context.createOscillator();source.frequency.value=440;const id=this.attach('440 Hz test tone','tone',source);source.start();return id;}
  async addFile(file){
    if(this.channels.size>=8)throw Error('Eight audio channels are already occupied.');
    await this.enable();const media=new Audio();media.preload='metadata';media.src=file.url;
    const source=this.context.createMediaElementSource(media);let id;
    try{id=this.attach(file.name,'file',source,{media,playing:false});}catch(e){source.disconnect();media.removeAttribute('src');media.load();throw e;}
    media.onended=()=>{const c=this.channels.get(id);if(c){c.playing=false;this.emit();}};
    media.onerror=()=>{this.onError(`Unable to play ${file.name}. Check that the file still exists and its format is supported.`);this.remove(id);};return id;
  }
  async togglePlayback(id){const c=this.channels.get(id);if(!c?.media)return;await this.enable();if(c.media.paused){await c.media.play();c.playing=true;}else{c.media.pause();c.playing=false;}this.emit();}
  remove(id){const c=this.channels.get(id);if(!c)return;
    c.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});
    if(c.kind==='tone')c.source.stop();
    if(c.media){c.media.onended=null;c.media.onerror=null;c.media.pause();c.media.removeAttribute('src');c.media.load();}
    c.source.disconnect();c.gain.disconnect();c.analyser.disconnect();this.channels.delete(id);this.emit();
  }
  levels(){const sample=new Float32Array(512);const read=node=>{node.getFloatTimeDomainData(sample);return levelDb(sample);};return {master:read(this.masterMeter),channels:Object.fromEntries([...this.channels.values()].map(c=>[c.id,read(c.analyser)]))};}
  dispose(){if(this.disposed)return;this.disposed=true;[...this.channels.keys()].forEach(id=>this.remove(id));this.destination.stream.getTracks().forEach(t=>t.stop());this.context.onstatechange=null;this.masterGain.disconnect();this.masterMeter.disconnect();this.context.close().catch(()=>{});}
}
