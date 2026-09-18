import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEpsFonts } from '../src/eps-fonts.js';

test('embedded and standard EPS fonts are safe',()=>{
  const eps='/FontName /BrandFont def\n/BrandFont findfont\n/Helvetica findfont';
  assert.deepEqual(inspectEpsFonts(eps),{
    embedded:['BrandFont'],referenced:['BrandFont','Helvetica'],nonEmbedded:[],missing:[],status:'safe',
  });
});

test('live non-embedded EPS fonts warn without blocking',()=>{
  const result=inspectEpsFonts('/CustomerFont findfont');
  assert.deepEqual(result.nonEmbedded,['CustomerFont']);
  assert.equal(result.status,'warning');
});

test('Ghostscript substitution blocks export and names the missing font',()=>{
  const result=inspectEpsFonts('/MissingFont findfont',['Substituting font Courier for MissingFont.']);
  assert.deepEqual(result.missing,['MissingFont']);
  assert.equal(result.status,'missing');
});

test('generic Ghostscript file lookup messages do not invent a missing font',()=>{
  const result=inspectEpsFonts('',['Can\'t find (or can\'t open) font file /Resource/Font/NimbusSans.']);
  assert.deepEqual(result.missing,[]);
  assert.equal(result.status,'safe');
});
