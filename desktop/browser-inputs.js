const {randomUUID}=require('node:crypto');
function browserUrl(value){let url;try{url=new URL(String(value).trim());}catch{throw Error('Enter a complete HTTP or HTTPS website address.');}if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error('Browser inputs require HTTP(S) without embedded credentials.');return url.href;}
class BrowserInputs{
 constructor(BrowserWindow,onFrame,onEnded){this.BrowserWindow=BrowserWindow;this.onFrame=onFrame;this.onEnded=onEnded;this.windows=new Map();}
 async start(value){const url=browserUrl(value);if(this.windows.size>=8)throw Error('Eight browser inputs are already open.');const id=randomUUID();
  const win=new this.BrowserWindow({show:false,width:1280,height:720,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,partition:'gen3d-browser-'+id}});this.windows.set(id,win);
  win.webContents.setAudioMuted(true);win.webContents.setFrameRate(15);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  win.webContents.on('will-navigate',(event,next)=>{try{browserUrl(next);}catch{event.preventDefault();}});
  win.webContents.on('paint',(_event,_rect,image)=>{if(!win.isDestroyed())this.onFrame({id,data:image.toJPEG(75)});});
  win.webContents.on('render-process-gone',()=>{this.stop(id);this.onEnded(id);});
  try{await win.loadURL(url);return {id};}catch{this.stop(id);throw Error('The browser source could not load. Check the address and network access.');}
 }
 stop(id){const win=this.windows.get(id);this.windows.delete(id);if(win&&!win.isDestroyed())win.destroy();}
 dispose(){for(const id of this.windows.keys())this.stop(id);}
}
module.exports={BrowserInputs,browserUrl};
