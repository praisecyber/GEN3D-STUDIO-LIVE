export const defaultComposition={pipEnabled:false,pipSource:'',pipCorner:'bottom-right',pipScale:.28,keyEnabled:false,keySource:'',keyMode:'chroma',keyColor:'#00ff00',keyTolerance:90,keySoftness:40,keySpill:.4,lumaThreshold:180,lumaDark:false};
const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
export function normalizeComposition(value){return {...defaultComposition,...value,pipScale:clamp(value.pipScale,.15,.5,.28),pipCorner:['top-left','top-right','bottom-left','bottom-right'].includes(value.pipCorner)?value.pipCorner:'bottom-right',keyMode:value.keyMode==='luma'?'luma':'chroma',keyColor:/^#[0-9a-f]{6}$/i.test(value.keyColor)?value.keyColor:'#00ff00',keyTolerance:clamp(value.keyTolerance,0,441,90),keySoftness:clamp(value.keySoftness,0,150,40),keySpill:clamp(value.keySpill,0,1,.4),lumaThreshold:clamp(value.lumaThreshold,0,255,180)};}
export function pipRect(w,h,scale,corner){const width=w*scale,height=width*9/16,marginX=w*.035,marginY=h*.035;return {x:corner.endsWith('right')?w-marginX-width:marginX,y:corner.startsWith('bottom')?h-marginY-height:marginY,width,height};}
export function removeCompositionSource(settings,id){return {...settings,...(settings.pipSource===id?{pipSource:'',pipEnabled:false}:{}),...(settings.keySource===id?{keySource:'',keyEnabled:false}:{})};}
export function applyKey(pixels,settings){
  const c=normalizeComposition(settings),color=parseInt(c.keyColor.slice(1),16),kr=color>>16,kg=(color>>8)&255,kb=color&255;
  const dominant=kg>kr&&kg>kb?1:kb>kr&&kb>kg?2:kr>kg&&kr>kb?0:-1;
  for(let i=0;i<pixels.length;i+=4){if(!pixels[i+3])continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2];let keep;
    if(c.keyMode==='luma'){const luma=.2126*r+.7152*g+.0722*b;const distance=c.lumaDark?luma-c.lumaThreshold:c.lumaThreshold-luma;keep=c.keySoftness?Math.max(0,Math.min(1,distance/c.keySoftness)):distance>0?1:0;}
    else{const distance=Math.sqrt((r-kr)**2+(g-kg)**2+(b-kb)**2);keep=c.keySoftness?Math.max(0,Math.min(1,(distance-c.keyTolerance)/c.keySoftness)):distance>c.keyTolerance?1:0;
      if(c.keySpill&&keep<1&&dominant>=0){const other=dominant===0?Math.max(g,b):dominant===1?Math.max(r,b):Math.max(r,g);pixels[i+dominant]=Math.round(pixels[i+dominant]-(Math.max(0,pixels[i+dominant]-other)*c.keySpill*(1-keep)));}
    }
    pixels[i+3]=Math.round(pixels[i+3]*keep);
  }return pixels;
}
