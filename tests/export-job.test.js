import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { buildExportFileName, drawExportFileName, extractSNumber } from '../src/export-job.js';

test('extracts an S-number and builds the requested production filename', () => {
  assert.equal(extractSNumber('S07779-OP.pdf'), 'S07779');
  assert.equal(extractSNumber('customer-s12345 proof.PDF'), 'S12345');
  assert.equal(buildExportFileName({ sourceName: 'S07779-OP.pdf', media: 'PP Gloss', lamination: 'Gloss Laminate', sheets: 5 }), 'S07779-PP Gloss-Gloss Laminate-5 sheets.pdf');
});

test('omits S-number and optional finishes when they are not selected', () => {
  assert.equal(extractSNumber('OP.pdf'), '');
  assert.equal(buildExportFileName({ sourceName: 'OP.pdf', media: 'PP Gloss', lamination: 'None', sheets: 1 }), 'PP Gloss-1 sheet.pdf');
  assert.equal(buildExportFileName({ sourceName: 'OP.pdf', media: 'PP Gloss', lamination: 'Matte Laminate', goldFoil: true, sheets: 2 }), 'PP Gloss-2 sheets.pdf');
});

test('custom export file name overrides the suggested production name and restores on reset', () => {
  const settings = { sourceName: 'S07779-OP.pdf', media: 'PP Gloss', sheets: 2 };
  assert.equal(buildExportFileName({ ...settings, customName: 'Urgent · S07779' }), 'Urgent S07779.pdf');
  assert.equal(buildExportFileName({ ...settings, customName: 'proof.pdf' }), 'proof.pdf');
  assert.equal(buildExportFileName({ ...settings, customName: '' }), 'S07779-PP Gloss-2 sheets.pdf');
});

test('draws a safe filename label at 5 mm from the page top and left', async () => {
  const pdf = await PDFDocument.create();
  const sheet = { w: 330.2, h: 482.6 };
  const page = pdf.addPage([sheet.w * 72 / 25.4, sheet.h * 72 / 25.4]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  drawExportFileName(page, sheet, 'S07779-PP Gloss-5 sheets.pdf', font);
  const loaded = await PDFDocument.load(await pdf.save());
  const streams = loaded.getPage(0).node.Contents();
  const content = Array.from({ length: streams.size() }, (_, index) => Buffer.from(decodePDFRawStream(streams.lookup(index)).decode()).toString()).join('');
  const [, x, y] = content.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
  assert.ok(Math.abs(Number(x) - 5 * 72 / 25.4) < 0.000001);
  assert.ok(Math.abs((sheet.h * 72 / 25.4 - Number(y) - font.heightAtSize(7)) - 5 * 72 / 25.4) < 0.000001);
  const [, encoded] = content.match(/<([0-9A-F]+)> Tj/);
  assert.equal(Buffer.from(encoded, 'hex').toString(), 'S07779-PP Gloss-5 sheets.pdf');
});

test('download filename can stay in metadata/name only without printing a label on the sheet', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([330.2 * 72 / 25.4, 482.6 * 72 / 25.4]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  drawExportFileName(page, { w: 330.2, h: 482.6 }, 'S07779-PP Gloss-5 sheets.pdf', font, false);
  assert.equal(page.node.Contents(), undefined);
  assert.equal(buildExportFileName({ sourceName: 'S07779-OP.pdf', media: 'PP Gloss', sheets: 5 }), 'S07779-PP Gloss-5 sheets.pdf');
});
