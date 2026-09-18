import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { inspectPdfFonts } from '../src/pdf-fonts.js';

async function pdfWithFont({ embedded }) {
  const pdf = await PDFDocument.create();
  const descriptor = pdf.context.obj({
    Type:'FontDescriptor',
    FontName:'ABCDEF+WeirdTalks-Regular',
    ...(embedded ? { FontFile2:pdf.context.flateStream(new Uint8Array([0,1,2,3])) } : {}),
  });
  const font = pdf.context.obj({
    Type:'Font', Subtype:'TrueType', BaseFont:'ABCDEF+WeirdTalks-Regular',
    FontDescriptor:pdf.context.register(descriptor),
  });
  pdf.context.register(font);
  return pdf.save({ useObjectStreams:false });
}

test('embedded PDF subset font is safe without a locally installed font',async()=>{
  const result=await inspectPdfFonts(await pdfWithFont({embedded:true}));
  assert.deepEqual(result.embedded,['WeirdTalks-Regular']);
  assert.deepEqual(result.nonEmbedded,[]);
  assert.equal(result.status,'safe');
});

test('non-embedded custom PDF font produces a warning',async()=>{
  const result=await inspectPdfFonts(await pdfWithFont({embedded:false}));
  assert.deepEqual(result.nonEmbedded,['WeirdTalks-Regular']);
  assert.equal(result.status,'warning');
});
