import test from 'node:test';
import assert from 'node:assert/strict';
import { detectEpsArtboards } from '../src/eps-artboards.js';

const path=(d,box)=>({d,box,points:[[box[0],box[1]],[box[0]+box[2],box[1]+box[3]]]});

test('two equal Cut Line shells become left-to-right EPS artboards with their holes',()=>{
  const result=detectEpsArtboards([
    path('right outer',[500,20,200,200]),path('right hole',[590,100,20,20]),
    path('left outer',[10,20,200,200]),path('left hole',[100,100,20,20]),
  ],[736,248]);
  assert.equal(result.length,2);
  assert.equal(result[0].d,'left outer left hole');
  assert.equal(result[1].d,'right outer right hole');
  assert.deepEqual(result[0].crop,[0,0,355,248]);
  assert.deepEqual(result[1].crop,[355,0,736,248]);
});

test('unequal loose Cut Line objects remain one EPS canvas',()=>{
  const result=detectEpsArtboards([path('large',[0,0,200,200]),path('small',[300,0,50,50])],[400,200]);
  assert.deepEqual(result,[]);
});
