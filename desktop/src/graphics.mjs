export const defaultGraphics={lowerThirdEnabled:false,title:'',subtitle:'',lyricsEnabled:false,logoEnabled:false,logoName:''};
export function fitRect(sw,sh,dw,dh){if(![sw,sh,dw,dh].every(n=>Number.isFinite(n)&&n>0))return null;const scale=Math.min(dw/sw,dh/sh);const width=sw*scale,height=sh*scale;return {x:(dw-width)/2,y:(dh-height)/2,width,height};}
export function wrapText(text,maxWidth,measure,maxLines=7){
  const lines=[];const paragraphs=String(text).replace(/\r/g,'').split('\n');
  for(const paragraph of paragraphs){let line='';for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
    if(measure(word)>maxWidth){if(line){lines.push(line);line='';}let piece='';for(const char of Array.from(word)){if(piece&&measure(piece+char)>maxWidth){lines.push(piece);piece='';}piece+=char;}line=piece;}
    else if(!line)line=word;else if(measure(line+' '+word)<=maxWidth)line+=' '+word;else{lines.push(line);line=word;}
  }lines.push(line);}
  const truncated=lines.length>maxLines;const visible=lines.slice(0,maxLines);
  if(truncated){let last=visible.at(-1)||'';while(last&&measure(last+'…')>maxWidth)last=Array.from(last).slice(0,-1).join('');visible[visible.length-1]=last+'…';}
  return {lines:visible,truncated};
}
export function drawGraphics(ctx,graphics,projectionText,logo){
  const w=ctx.canvas.width,h=ctx.canvas.height;ctx.save();
  if(graphics.lyricsEnabled&&projectionText.trim()){
    let size=w*.035,layout;
    do{ctx.font=`600 ${size}px sans-serif`;layout=wrapText(projectionText,w*.84,t=>ctx.measureText(t).width,99);if(layout.lines.length<=6||size<=w*.021)break;size-=2;}while(size>0);
    layout=wrapText(projectionText,w*.84,t=>ctx.measureText(t).width,7);
    const lineHeight=size*1.28,height=layout.lines.length*lineHeight+28;
    const center=graphics.lowerThirdEnabled?h*.44:h*.65,top=Math.max(h*.09,Math.min(h-height-h*.07,center-height/2));
    ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(w*.055,top,w*.89,height);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
    layout.lines.forEach((line,i)=>ctx.fillText(line,w/2,top+14+lineHeight*(i+.5)));
  }
  if(graphics.lowerThirdEnabled&&(graphics.title||graphics.subtitle)){
    ctx.fillStyle='rgba(8,16,32,.94)';ctx.fillRect(w*.045,h*.79,w*.78,h*.15);ctx.fillStyle='#6698ff';ctx.fillRect(w*.045,h*.79,w*.006,h*.15);
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.font=`700 ${w*.027}px sans-serif`;ctx.fillStyle='#fff';ctx.fillText(graphics.title,w*.07,h*.845,w*.70);
    ctx.font=`400 ${w*.018}px sans-serif`;ctx.fillStyle='#b9ccef';ctx.fillText(graphics.subtitle,w*.07,h*.897,w*.70);
  }
  if(graphics.logoEnabled&&logo?.naturalWidth){const box=fitRect(logo.naturalWidth,logo.naturalHeight,w*.13,h*.16);if(box)ctx.drawImage(logo,w*.965-w*.13+box.x,h*.035+box.y,box.width,box.height);}
  ctx.restore();
}
