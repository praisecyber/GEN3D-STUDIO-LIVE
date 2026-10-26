/* Read-only conversion of the documented Holyrics Lyrics/GetSongs JSON model. */
(function(root,factory){if(typeof module!=='undefined'&&module.exports)module.exports=factory(require('./projection-library'),require('./worship-data'));else root.Gen3DHolyrics=factory(root.Gen3DLibrary,root.Gen3DAdmin);})(globalThis,(library,admin)=>{
 function normalize(payload){const rows=Array.isArray(payload)?payload:payload?.status==='ok'?payload.data:null;if(!Array.isArray(rows)||rows.length>5000)throw Error('Choose a Holyrics GetSongs JSON response containing up to 5,000 songs.');const songs=[],rejected=[];for(const row of rows){try{if(!row||!Array.isArray(row.slides)||!row.slides.length||row.slides.length>1000||row.slides.some(slide=>!slide||typeof slide.text!=='string'||!slide.text.trim()))throw Error('Basic non-empty text slides are required; styled-only or blank slides need review in Holyrics.');let slides=row.slides.map(slide=>slide.text);if(row.order!==undefined&&row.order!==null&&row.order!==''){if(typeof row.order!=='string'||row.order.length>10000)throw Error('Invalid slide order.');const order=row.order.split(',').map(index=>index.trim());if(!order.length||order.length>1000||order.some(index=>!/^\d+$/.test(index)||Number(index)<1||Number(index)>slides.length))throw Error('Invalid slide order.');slides=order.map(index=>slides[Number(index)-1]);}const metadata={source:'Holyrics',sourceId:String(row.id??''),artist:row.artist||'',author:row.author||'',copyright:row.copyright||'',note:row.note||'',key:row.key||'',groups:(row.groups||[]).map(group=>group.name),archived:row.archived===true};songs.push(...library.validateSongs([{title:row.title,slides,metadata}]));}catch(error){rejected.push({title:typeof row?.title==='string'?row.title.slice(0,300):'Untitled song',reason:error.message});}}return {songs,rejected};}
 function prepareImport(existing,incoming,administration,includeGroups=true){
  const merged=library.mergeSongs(existing,incoming),next=admin.validate(administration),warnings=[];
  const previousTitles=new Set(existing.map(song=>song.title.trim().toLocaleLowerCase()));
  let grouped=0;
  if(includeGroups)for(const song of merged.songs){
   if(previousTitles.has(song.title.trim().toLocaleLowerCase()))continue;
   const source=[...new Set(song.metadata?.groups||[])];
   if(!source.length)continue;
   // Existing local assignments also survive when their song was deleted earlier.
   if(Object.hasOwn(next.groups,song.title)){warnings.push(`${song.title}: kept existing local group assignments.`);continue;}
   const accepted=source.filter(group=>group.length<=40).slice(0,10);
   if(accepted.length!==source.length)warnings.push(`${song.title}: only the first 10 group names up to 40 characters can become filters; all source groups remain in song credits.`);
   if(accepted.length){Object.defineProperty(next.groups,song.title,{value:accepted,enumerable:true,writable:true,configurable:true});grouped++;}
  }
  return {...merged,administration:admin.validate(next),grouped,warnings};
 }
 return {normalize,prepareImport};
});
