export function waitForMedia(element,event,ready,timeout=15000){return new Promise((resolve,reject)=>{
  let timer;
  function cleanup(){clearTimeout(timer);element.removeEventListener(event,success);element.removeEventListener('error',failure);}
  function success(){cleanup();resolve();}
  function failure(){cleanup();reject(Error('This media file could not be loaded. Check its location and format.'));}
  if(ready()){resolve();return;}
  element.addEventListener(event,success,{once:true});element.addEventListener('error',failure,{once:true});timer=setTimeout(()=>{cleanup();reject(Error('Media loading timed out.'));},timeout);
});}
export async function loadImage(url){const image=new Image();const loaded=waitForMedia(image,'load',()=>image.complete&&image.naturalWidth>0);image.src=url;await loaded;return image;}
