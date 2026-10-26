/* Shared, bounded stage-layout data. Percentages are relative to the display. */
(function(root){
 const widgets=['clock','current','next','timer','message','count'];
 const defaults={clock:[4,3,40,9,5],current:[4,20,92,48,7],next:[4,72,92,16,4],timer:[55,3,40,10,6],message:[4,89,92,8,4],count:[80,80,16,8,3]};
 function normalize(value={}){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid stage layout.');const result={name:typeof value.name==='string'?value.name.trim().slice(0,80)||'Stage':'Stage',uppercase:value.uppercase===true,textColor:/^#[0-9a-f]{6}$/i.test(value.textColor)?value.textColor:'#ffffff',backColor:/^#[0-9a-f]{6}$/i.test(value.backColor)?value.backColor:'#000000',widgets:{}};
  for(const key of widgets){const item=value.widgets?.[key]||{},d=defaults[key];const n=(field,fallback,min,max)=>{const number=item[field]===undefined?fallback:Number(item[field]);if(!Number.isFinite(number)||number<min||number>max)throw Error(`Invalid ${key} ${field}.`);return number;};const left=n('left',d[0],0,99),top=n('top',d[1],0,99);result.widgets[key]={visible:item.visible!==false,left,top,width:n('width',Math.min(d[2],100-left),1,100-left),height:n('height',Math.min(d[3],100-top),1,100-top),fontSize:n('fontSize',d[4],1,30)};}return result;}
 const api={normalize,widgets};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Gen3DStageLayout=api;
})(typeof globalThis!=='undefined'?globalThis:this);
