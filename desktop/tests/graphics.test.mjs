import {test} from 'node:test';import assert from 'node:assert/strict';import {fitRect,wrapText} from '../src/graphics.mjs';
test('visual sources preserve aspect ratio and center with letterboxing',()=>{assert.deepEqual(fitRect(100,200,1280,720),{x:460,y:0,width:360,height:720});assert.deepEqual(fitRect(640,360,1280,720),{x:0,y:0,width:1280,height:720});});
test('invalid media dimensions cannot create infinite canvas coordinates',()=>{for(const n of [0,-1,NaN,Infinity])assert.equal(fitRect(n,360,1280,720),null);});
test('lyrics wrap on words and preserve explicit line breaks',()=>{assert.deepEqual(wrapText('one two\nthree',7,s=>s.length).lines,['one two','three']);assert.deepEqual(wrapText('one two three',7,s=>s.length).lines,['one two','three']);});
test('long tokens wrap without overflowing and truncation is visible',()=>{const layout=wrapText('abcdefghijk',4,s=>s.length,2);assert.deepEqual(layout,{lines:['abcd','efg…'],truncated:true});assert.ok(layout.lines.every(line=>line.length<=4));});
test('Unicode surrogate pairs remain intact when a long token wraps',()=>{assert.deepEqual(wrapText('😀😀😀',2,s=>Array.from(s).length,3).lines,['😀😀','😀']);});
