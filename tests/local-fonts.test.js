import test from 'node:test';
import assert from 'node:assert/strict';
import { addLocalFontAvailability } from '../src/local-fonts.js';

const preflight = {
  embedded:['WeirdTalks-Regular'], referenced:['WeirdTalks-Regular'],
  nonEmbedded:[], missing:[], status:'safe',
};

test('embedded PDF font warns when it is absent from the local catalog',()=>{
  const result=addLocalFontAvailability(preflight,{status:'available',names:['Helvetica']});
  assert.deepEqual(result.notInstalled,['WeirdTalks-Regular']);
});

test('PostScript, full and family font names tolerate spaces and hyphens',()=>{
  const result=addLocalFontAvailability(preflight,{status:'available',names:['Weird Talks Regular']});
  assert.deepEqual(result.notInstalled,[]);
});

test('denied font access is explicit without inventing missing fonts',()=>{
  const result=addLocalFontAvailability(preflight,{status:'denied',names:[]});
  assert.equal(result.localFontStatus,'denied');
  assert.deepEqual(result.notInstalled,[]);
});
