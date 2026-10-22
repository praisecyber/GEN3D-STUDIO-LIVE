import {test} from 'node:test';import assert from 'node:assert/strict';import {recordingMime} from '../src/recorder.mjs';
test('recording selects supported codec instead of assuming encoder support',()=>{assert.equal(recordingMime({isTypeSupported:t=>t==='video/webm'}),'video/webm');assert.throws(()=>recordingMime({isTypeSupported:()=>false}),/No supported/);});
