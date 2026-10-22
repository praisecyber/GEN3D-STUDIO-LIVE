import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampGain,levelDb,setGain} from '../src/audio.mjs';
test('invalid gain values fail closed and valid values stay within unity',()=>{for(const x of [NaN,Infinity,'invalid',-1])assert.equal(clampGain(x),0);assert.equal(clampGain(2),1);assert.equal(clampGain(.35),.35);});
test('meter reads silence as floor and signed peaks as dBFS',()=>{assert.equal(levelDb(new Float32Array(512)),-60);assert.equal(levelDb([0,-1,.5]),0);assert.ok(Math.abs(levelDb([-.5,.2])+6.0206)<.001);assert.equal(levelDb([.00001]),-60);});
test('mute overrides volume and smooth gain changes use the audio clock',()=>{let args;const node={gain:{setTargetAtTime(...v){args=v;}}};setGain(node,.8,true,{currentTime:12});assert.deepEqual(args,[0,12,.015]);setGain(node,2,false,{currentTime:20});assert.deepEqual(args,[1,20,.015]);});
