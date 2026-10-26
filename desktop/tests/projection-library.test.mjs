import test from 'node:test';
import assert from 'node:assert/strict';
import library from '../renderer/projection-library.js';
const {parseSongs,mergeSongs,formatCountdown}=library;
test('plain text import preserves slide boundaries and normalizes Windows newlines',()=>{
 assert.deepEqual(parseSongs('\uFEFFSample\r\nFirst line\r\nSecond line\r\n\r\nChorus','sample.txt'),[{title:'Sample',slides:['First line\nSecond line','Chorus']}]);
});
test('portable libraries reject invalid rows atomically and strip unexpected fields',()=>{
 assert.throws(()=>parseSongs('{"songs":[{"title":"OK","slides":["Hello"]},{"title":"Bad","slides":[]}]}','songs.json'),/Song 2/);
 assert.deepEqual(parseSongs('[{"title":" Title ","slides":[" Verse "],"url":"ignored"}]','songs.json'),[{title:'Title',slides:['Verse']}]);
 assert.throws(()=>parseSongs('title\n','empty.txt'),/non-empty/);
 assert.throws(()=>parseSongs('<!DOCTYPE song>','song.xml'),/document types/);
});
test('library merge keeps existing songs and skips duplicate incoming titles',()=>{
 const existing=[{title:'Welcome',slides:['Original']}];const incoming=[{title:' welcome ',slides:['Changed']},{title:'New',slides:['New']},{title:'NEW',slides:['Duplicate']}];
 assert.deepEqual(mergeSongs(existing,incoming),{songs:[...existing,incoming[1]],added:1,skipped:2});assert.equal(existing.length,1);
});
test('stage countdown uses an absolute deadline, supports pause, and clamps at zero',()=>{
 assert.equal(formatCountdown({endsAt:61000},1000),'01:00');assert.equal(formatCountdown({endsAt:61000},60500),'00:01');assert.equal(formatCountdown({endsAt:61000},62000),'00:00');assert.equal(formatCountdown({endsAt:0,remaining:125}),'02:05');assert.equal(formatCountdown(null),'');
});
const {validateBible,findPassage}=library;
const module=validateBible({translation:'Test',verses:[{book:'Example',chapter:1,verse:1,text:'First verse'},{book:'Example',chapter:1,verse:2,text:'Second verse'},{book:'Example',chapter:1,verse:4,text:'Fourth verse'}]});
test('offline Bible finds references and text while refusing incomplete ranges',()=>{
 assert.equal(findPassage(module,'example 1:1–2').length,2);assert.equal(findPassage(module,'Example 1').length,3);assert.equal(findPassage(module,'second')[0].verse,2);assert.throws(()=>findPassage(module,'Example 1:1-4'),/complete/);assert.throws(()=>findPassage(module,'Example 1:4-1'),/last verse/);
});
test('Bible module validation rejects duplicate references and malformed verse numbers',()=>{
 assert.throws(()=>validateBible({translation:'Test',verses:[module.verses[0],module.verses[0]]}),/Duplicate/);assert.throws(()=>validateBible({translation:'Test',verses:[{book:'Example',chapter:1,verse:0,text:'Invalid'}]}),/Invalid Bible verse/);
});
test('project restore rolls back earlier writes if a later storage write fails',()=>{
 const values=new Map([['songs','old songs'],['style','old style']]);let writes=0;
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(++writes===2)throw Error('Quota exceeded');values.set(key,value);},removeItem:key=>values.delete(key)};
 assert.throws(()=>library.commitSettings(storage,{songs:'new songs',style:'new style'}),/Previous settings were restored/);assert.equal(values.get('songs'),'old songs');assert.equal(values.get('style'),'old style');
});
test('automatic slide formatting respects line and width limits without splitting Unicode code points',()=>{const slides=library.formatSlides(['One two three four five six seven eight nine ten','😀'.repeat(40)],2,15);assert.ok(slides.length>2);for(const slide of slides){assert.ok(slide.split('\n').length<=2);for(const line of slide.split('\n'))assert.ok(Array.from(line).length<=15);}assert.equal(slides.slice(0,-2).join(' ').replace(/\s+/g,' ').trim().startsWith('One two'),true);});
test('portable project media is limited to local media references and stage settings validate colors',()=>{assert.throws(()=>library.validateMedia([{title:'Web',type:'video',url:'https://example.com/movie.mp4'}]),/local files/);assert.equal(library.validateMedia([{title:'Local',type:'video',url:'file:///tmp/movie.mp4'}])[0].slides[0],'Local');assert.throws(()=>library.stageSettings({textColor:'red;invalid'}));assert.equal(library.stageSettings({uppercase:true}).showNext,true);});
test('imported media URLs are normalized and theme backgrounds cannot inject markup',()=>{const row=library.validateMedia([{title:'Local',type:'video',url:'file:///tmp/a"b.mp4'}])[0];assert.equal(row.url.includes('"'),false);const theme=library.validateThemes([{name:'Theme',style:{},background:'file:///tmp/a"b.jpg'}])[0];assert.equal(theme.background.includes('"'),false);assert.throws(()=>library.validateThemes([{name:'Theme',style:{},background:'https://example.com/file.jpg'}]),/local files/);});
