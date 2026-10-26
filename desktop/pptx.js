const JSZip = require('jszip');
const fs = require('fs');
const dec=s=>s.replace(/&(#x[0-9a-f]+|#[0-9]+|lt|gt|quot|apos|amp);/gi,(_entity,value)=>{if(value[0]==='#'){const n=value[1].toLowerCase()==='x'?parseInt(value.slice(2),16):Number(value.slice(1));return n<=0x10ffff?String.fromCodePoint(n):'�';}return {lt:'<',gt:'>',quot:'"',apos:"'",amp:'&'}[value.toLowerCase()];});
// Reads the text of each slide (one projection slide per PowerPoint slide). Images and animations are not imported yet.
async function parsePptx(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const num = n => parseInt(n.match(/slide(\d+)\.xml$/)[1], 10);
  let names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  const presentation=zip.file('ppt/presentation.xml'),relationships=zip.file('ppt/_rels/presentation.xml.rels');
  if(presentation&&relationships){const rels=new Map();for(const match of (await relationships.async('string')).matchAll(/<Relationship\b([^>]+)>/g)){const attr=match[1],id=attr.match(/\bId=["']([^"']+)["']/)?.[1],target=attr.match(/\bTarget=["']([^"']+)["']/)?.[1];if(id&&target)rels.set(id,target.startsWith('/ppt/')?target.slice(1):'ppt/'+target);}const ordered=[];for(const match of (await presentation.async('string')).matchAll(/<(?:\w+:)?sldId\b([^>]+)>/g)){const id=match[1].match(/\br:id=["']([^"']+)["']/)?.[1],target=rels.get(id);if(target&&names.includes(target))ordered.push(target);else throw Error('PowerPoint contains an unresolved slide reference.');}if(ordered.length===names.length)names=ordered;else throw Error('PowerPoint slide order is incomplete.');}
  const slides = [];
  for (const n of names) {
    const xml = await zip.file(n).async('string');
    const paras = xml.split('</a:p>')
      .map(p => [...p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => dec(m[1])).join(''))
      .filter(t => t.trim());
    slides.push(paras.join('\n') || '(no text on this slide)');
  }
  return slides;
}
module.exports = { parsePptx };
