/* Shared validation for portable song libraries. No file or network access. */
(function(root){
  function validateSongs(value){
    const rows=Array.isArray(value)?value:value?.songs;
    if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw Error('Choose a library containing 1–5000 songs.');
    return rows.map((song,i)=>{
      if(!song||typeof song.title!=='string'||!song.title.trim()||song.title.length>300||!Array.isArray(song.slides)||!song.slides.length||song.slides.length>1000||song.slides.some(s=>typeof s!=='string'||!s.trim()||s.length>20000))throw Error(`Song ${i+1} needs a title and non-empty text slides.`);
      const clean={title:song.title.trim(),slides:song.slides.map(s=>s.trim())};
      if(song.metadata!==undefined){const source=song.metadata;if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Invalid song credits.');const metadata={};for(const [field,limit]of [['source',100],['sourceId',1000],['artist',2000],['author',2000],['copyright',4000],['note',20000],['key',40]])if(source[field]!==undefined){if(typeof source[field]!=='string'||source[field].length>limit)throw Error('Invalid song credits.');metadata[field]=source[field];}if(source.groups!==undefined){if(!Array.isArray(source.groups)||source.groups.length>100||source.groups.some(group=>typeof group!=='string'||!group.trim()||group.length>100))throw Error('Invalid source song groups.');metadata.groups=source.groups.map(group=>group.trim());}if(source.archived!==undefined)metadata.archived=source.archived===true;clean.metadata=metadata;}
      return clean;
    });
  }
  function parseSongs(text,name,Parser=root.DOMParser){
    if(new TextEncoder().encode(text).length>5*1024*1024)throw Error('Song files must be smaller than 5 MB.');
    if(/\.json$/i.test(name))return validateSongs(JSON.parse(text));
    if(/\.xml$/i.test(name)){
      if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML document types and entities are not supported.');
      const doc=new Parser().parseFromString(text,'application/xml');
      if(doc.querySelector('parsererror')||doc.documentElement.localName!=='song'||doc.documentElement.namespaceURI!=='http://openlyrics.info/namespace/2009/song')throw Error('Choose an OpenLyrics song XML file.');
      const title=doc.querySelector('properties titles title')?.textContent||'';
      const verses=new Map();
      for(const verse of doc.querySelectorAll('lyrics verse')){
        const blocks=[...verse.querySelectorAll('lines')].map(lines=>{
          const copy=lines.cloneNode(true);for(const br of copy.querySelectorAll('br'))br.replaceWith(doc.createTextNode('\n'));return copy.textContent.trim();
        }).filter(Boolean);
        const key=verse.getAttribute('name');if(!key||verses.has(key))throw Error('OpenLyrics verse names must be present and unique.');verses.set(key,blocks);
      }
      const order=doc.querySelector('verseOrder')?.textContent.trim().split(/\s+/).filter(Boolean);
      if(order?.some(key=>!verses.has(key)))throw Error('The verse order references a missing verse.');
      return validateSongs([{title,slides:(order?.length?order:[...verses.keys()]).flatMap(key=>verses.get(key))}]);
    }
    if(!/\.txt$/i.test(name))throw Error('Choose a JSON, plain text, or OpenLyrics XML file.');
    const clean=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
    const [title,...lines]=clean.split('\n');
    return validateSongs([{title,slides:lines.join('\n').trim().split(/\n\s*\n/).filter(Boolean)}]);
  }
  function mergeSongs(existing,incoming){
    const known=new Set(existing.map(s=>s.title.trim().toLocaleLowerCase()));let skipped=0;
    const added=incoming.filter(s=>{const key=s.title.trim().toLocaleLowerCase();if(known.has(key)){skipped++;return false;}known.add(key);return true;});
    return {songs:[...existing,...added],added:added.length,skipped};
  }
  function formatCountdown(timer,now=Date.now()){
    if(!timer)return '';const remaining=timer.endsAt?Math.ceil((timer.endsAt-now)/1000):timer.remaining;
    const total=Math.max(0,Math.min(359999,Number(remaining)||0));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }
  function validateBible(data){
    if(!data||typeof data.translation!=='string'||!data.translation.trim()||data.translation.length>100||!Array.isArray(data.verses)||!data.verses.length||data.verses.length>100000)throw Error('A Bible module needs a translation name and 1–100000 verses.');
    const seen=new Set();
    const verses=data.verses.map((v,i)=>{
      if(!v||typeof v.book!=='string'||!v.book.trim()||v.book.length>100||!Number.isInteger(v.chapter)||v.chapter<1||v.chapter>200||!Number.isInteger(v.verse)||v.verse<1||v.verse>200||typeof v.text!=='string'||!v.text.trim()||v.text.length>10000)throw Error(`Invalid Bible verse ${i+1}.`);
      const clean={book:v.book.trim(),chapter:v.chapter,verse:v.verse,text:v.text.trim()};const key=`${clean.book.toLowerCase()}:${v.chapter}:${v.verse}`;if(seen.has(key))throw Error('Duplicate Bible verse reference.');seen.add(key);return clean;
    });return {translation:data.translation.trim(),verses};
  }
  function parseBible(text,name,Parser=root.DOMParser){
    if(!/\.xml$/i.test(name))return validateBible(JSON.parse(text));
    if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Bible XML document types and entities are not supported.');
    const doc=new Parser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Malformed Bible XML.');
    const rootNode=doc.documentElement,verses=[];let translation=rootNode.getAttribute('biblename')||rootNode.getAttribute('name')||name.replace(/\.xml$/i,'');
    if(rootNode.localName==='XMLBIBLE'){for(const book of rootNode.querySelectorAll('BIBLEBOOK'))for(const chapter of book.querySelectorAll('CHAPTER'))for(const verse of chapter.querySelectorAll('VERS'))verses.push({book:book.getAttribute('bname'),chapter:Number(chapter.getAttribute('cnumber')),verse:Number(verse.getAttribute('vnumber')),text:verse.textContent});}
    else if(rootNode.localName==='bible'){for(const book of rootNode.querySelectorAll('b'))for(const chapter of book.querySelectorAll('c'))for(const verse of chapter.querySelectorAll('v'))verses.push({book:book.getAttribute('n'),chapter:Number(chapter.getAttribute('n')),verse:Number(verse.getAttribute('n')),text:verse.textContent});}
    else throw Error('Choose a GEN3D JSON, Zefania XML or OpenSong Bible file.');return validateBible({translation,verses});
  }
  function findPassage(module,query){
    const q=String(query).trim();if(!q)throw Error('Enter a passage reference or search words.');
    const ref=q.match(/^(.+?)\s+(\d+)(?::(\d+)(?:[-–](\d+))?)?$/);
    if(!ref)return module.verses.filter(v=>v.text.toLowerCase().includes(q.toLowerCase())).slice(0,50);
    const [,book,ch,start,end]=ref,chapter=Number(ch),first=start?Number(start):null,last=end?Number(end):first;
    if(end&&last<first)throw Error('The last verse must follow the first verse.');
    const found=module.verses.filter(v=>v.book.toLowerCase()===book.toLowerCase()&&v.chapter===chapter&&(first===null||(v.verse>=first&&v.verse<=last))).sort((a,b)=>a.verse-b.verse);
    if(first!==null&&found.length!==last-first+1)throw Error('The complete verse range is not available in this module.');return found;
  }
  function validateThemes(rows){if(!Array.isArray(rows)||rows.length>200)throw Error('Invalid theme library.');return rows.map(theme=>{if(!theme||typeof theme.name!=='string'||!theme.name.trim()||theme.name.length>80||!theme.style||typeof theme.style!=='object'||Array.isArray(theme.style))throw Error('Invalid saved theme.');let background='';if(theme.background){let url;try{url=new URL(theme.background);}catch{throw Error('Invalid theme background.');}if(url.protocol!=='file:')throw Error('Theme backgrounds must reference local files.');background=url.href;}return {name:theme.name.trim(),style:{...theme.style},outputScale:Math.max(.6,Math.min(1.6,Number(theme.outputScale)||1)),background,bgType:theme.bgType==='video'?'video':'image'};});}
  function stageSettings(value={}){const defaults={uppercase:false,showNext:true,showClock:true,showCount:true,textColor:'#ffffff',backColor:'#000000'};for(const key of ['uppercase','showNext','showClock','showCount'])if(key in value){if(typeof value[key]!=='boolean')throw Error('Invalid stage display setting.');defaults[key]=value[key];}for(const key of ['textColor','backColor'])if(key in value){if(typeof value[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(value[key]))throw Error('Invalid stage display color.');defaults[key]=value[key];}return defaults;}
  function validateMedia(rows){if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid project media library.');const local=value=>{if(typeof value!=='string'||value.length>10000)throw Error('Invalid media URL.');let url;try{url=new URL(value);}catch{throw Error('Invalid media URL.');}if(url.protocol!=='file:')throw Error('Project media must reference local files.');return url.href;};return rows.map(row=>{if(!row||typeof row.title!=='string'||!row.title.trim()||!['image','video','audio','deck'].includes(row.type))throw Error('Invalid media item.');if(row.type==='deck'){if(!Array.isArray(row.frames)||!row.frames.length||row.frames.length>200||!Array.isArray(row.slides)||row.slides.length!==row.frames.length||row.slides.some(s=>typeof s!=='string'||s.length>20000))throw Error('Invalid visual deck.');const frames=row.frames.map(local);return {title:row.title.trim(),type:'deck',url:frames[0],frames,slides:row.slides.map((text,i)=>text.trim()||'Slide '+(i+1))};}return {title:row.title.trim(),type:row.type,url:local(row.url),slides:[row.title.trim()]};});}
  function formatSlides(slides,maxLines=4,width=44){
    if(!Number.isInteger(maxLines)||maxLines<1||maxLines>12||!Number.isInteger(width)||width<15||width>100)throw Error('Use 1–12 lines and 15–100 characters per line.');
    const result=[];for(const slide of slides){const lines=[];for(const original of String(slide).split('\n')){let line='';for(const word of original.trim().split(/\s+/).filter(Boolean)){const chunks=Array.from(word);if(chunks.length>width){if(line){lines.push(line);line='';}while(chunks.length>width)lines.push(chunks.splice(0,width).join(''));line=chunks.join('');}else if(Array.from(line+(line?' ':'')+word).length>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);}for(let i=0;i<lines.length;i+=maxLines)result.push(lines.slice(i,i+maxLines).join('\n'));}return result;
  }
  function commitSettings(storage,entries){
    const before=Object.fromEntries(Object.keys(entries).map(key=>[key,storage.getItem(key)]));
    try{for(const [key,value]of Object.entries(entries))storage.setItem(key,value);}
    catch(error){let restored=true;for(const [key,value]of Object.entries(before)){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{restored=false;}}throw Error(restored?'Storage is full or unavailable. Previous settings were restored.':'Storage failed and some previous settings could not be restored.');}
  }
  const api={validateSongs,parseSongs,mergeSongs,formatCountdown,validateBible,parseBible,findPassage,validateThemes,stageSettings,validateMedia,formatSlides,commitSettings};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Gen3DLibrary=api;
})(globalThis);
