import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import { normalizePdfSelection } from '../src/pdf-normalize.js';

test('normalizes a selected EPS crop into one standalone PDF page',async()=>{
  const source=await PDFDocument.create(),page=source.addPage([400,200]);
  page.drawRectangle({x:20,y:20,width:100,height:100,color:rgb(1,0,0)});
  page.drawRectangle({x:280,y:20,width:100,height:100,color:rgb(0,0,1)});
  const normalized=await normalizePdfSelection(await source.save(),1,[200,0,400,200]);
  const result=await PDFDocument.load(normalized),selected=result.getPage(0);
  assert.equal(result.getPageCount(),1);
  assert.deepEqual(selected.getSize(),{width:200,height:200});
});

test('rejects invalid selected-artboard crop boxes',async()=>{
  const source=await PDFDocument.create();source.addPage([100,100]);
  await assert.rejects(normalizePdfSelection(await source.save(),1,[50,0,20,100]),/invalid crop box/);
});
