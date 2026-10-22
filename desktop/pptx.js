const JSZip = require('jszip');
const fs = require('fs');
const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
// Reads the text of each slide (one projection slide per PowerPoint slide). Images and animations are not imported yet.
async function parsePptx(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const num = n => parseInt(n.match(/slide(\d+)\.xml$/)[1], 10);
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
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
