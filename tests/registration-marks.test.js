import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { attachRegistrationMetadata, createOptionalContentLayers, DEFAULT_GRAPHTEC_MARK_TYPE, DEFAULT_REGISTRATION_OUTPUT_MODE, drawRegistrationBoxInLayer, drawRegistrationMarksInLayer, registrationMarkLayerName, registrationMarkPolygons, registrationMarksFitSheet, wrapPageInOptionalLayer } from '../src/registration-marks.js';

const box = { x: 20, y: 30, w: 200, h: 300 };
const sheet = { w: 330.2, h: 482.6 };

test('default registration export uses Graphtec Type 2 marks only', () => {
  assert.equal(DEFAULT_GRAPHTEC_MARK_TYPE, 'type2');
  assert.equal(DEFAULT_REGISTRATION_OUTPUT_MODE, 'marks');
  assert.match(registrationMarkLayerName(), /^reg_1 2 /);
});

test('Graphtec layer names match the tested Illustrator/Cutting Master syntax', () => {
  assert.equal(registrationMarkLayerName('type1', 1, 5), 'reg_1 1 0 25.00 1.00 5.00 100.00 1 0 2 0 0.00');
  assert.equal(registrationMarkLayerName('type2', 1, 5), 'reg_1 2 0 25.00 1.00 5.00 100.00 1 0 2 0 0.00');
});

test('each Graphtec corner is one closed, filled L-shaped vector with centered thickness', () => {
  const type1 = registrationMarkPolygons(box, 'type1', 5, 1);
  const type2 = registrationMarkPolygons(box, 'type2', 5, 1);
  assert.equal(type1.length, 4);
  assert.equal(type1[0].length, 6);
  assert.deepEqual(type1[0], [[20.5, 30.5], [15, 30.5], [15, 29.5], [19.5, 29.5], [19.5, 25], [20.5, 25]]);
  assert.deepEqual(type1[1], [[219.5, 30.5], [225, 30.5], [225, 29.5], [220.5, 29.5], [220.5, 25], [219.5, 25]]);
  assert.deepEqual(type2[0], [[19.5, 29.5], [25, 29.5], [25, 30.5], [20.5, 30.5], [20.5, 35], [19.5, 35]]);
  assert.deepEqual(type2[3], [[220.5, 330.5], [215, 330.5], [215, 329.5], [219.5, 329.5], [219.5, 325], [220.5, 325]]);
});

test('registration mark polygons stay within the paper', () => {
  assert.equal(registrationMarksFitSheet(sheet, box, 'type1', 5, 1), true);
  assert.equal(registrationMarksFitSheet(sheet, { ...box, x: 4 }, 'type1', 5, 1), false);
  assert.equal(registrationMarksFitSheet(sheet, { ...box, x: 0 }, 'type2', 5, 1), false);
});

test('PDF output contains separate named optional-content layers on both page content and marks', async () => {
  const pdf = await PDFDocument.create();
  const layers = createOptionalContentLayers(pdf, [
    { id: 'print', name: 'print' },
    { id: 'registrationBox', name: 'registration_box' },
    { id: 'regMarks', name: registrationMarkLayerName('type2', 1, 5) },
  ]);
  const page = pdf.addPage([sheet.w * 72 / 25.4, sheet.h * 72 / 25.4]);
  page.drawText('Artwork');
  wrapPageInOptionalLayer(pdf, page, layers.print);
  drawRegistrationBoxInLayer(pdf, page, sheet, box, layers.registrationBox);
  drawRegistrationMarksInLayer(pdf, page, sheet, box, layers.regMarks, { type: 'type2', length: 5, stroke: 1 });
  attachRegistrationMetadata(pdf, {
    sheet: [sheet.w, sheet.h], box, mode: 'both', type: 'type2', length: 5, thickness: 1,
    markLayer: registrationMarkLayerName('type2', 1, 5),
  });

  const loaded = await PDFDocument.load(await pdf.save());
  const metadataRef = loaded.catalog.get(PDFName.of('Metadata'));
  const metadata = Buffer.from(decodePDFRawStream(loaded.context.lookup(metadataRef)).decode()).toString();
  assert.match(metadata, /<nestcut:registrationSettings>1%2C330\.2%2C482\.6/);
  const optionalContent = loaded.catalog.lookup(PDFName.of('OCProperties'), PDFDict);
  const groups = optionalContent.lookup(PDFName.of('OCGs'), PDFArray);
  const names = groups.asArray().map(ref => loaded.context.lookup(ref, PDFDict).lookup(PDFName.of('Name'), PDFString).decodeText());
  assert.deepEqual(names, ['print', 'registration_box', registrationMarkLayerName('type2', 1, 5)]);

  const resources = loaded.getPage(0).node.Resources();
  const properties = resources.lookup(PDFName.of('Properties'), PDFDict);
  assert.ok(properties.has(PDFName.of('Layer_print')));
  assert.ok(properties.has(PDFName.of('Layer_registrationBox')));
  assert.ok(properties.has(PDFName.of('Layer_regMarks')));
  const content = loaded.getPage(0).node.Contents();
  const streams = content instanceof PDFArray ? content.asArray() : [content];
  const decoded = streams.map(ref => Buffer.from(decodePDFRawStream(loaded.context.lookup(ref)).decode()).toString()).join('\n');
  assert.match(decoded, /\/OC \/Layer_print BDC/);
  assert.match(decoded, /\/OC \/Layer_registrationBox BDC/);
  assert.match(decoded, /\/OC \/Layer_regMarks BDC/);
  assert.match(decoded, /0 0 0 rg/);
  assert.equal((decoded.match(/h f/g) || []).length, 4);
  assert.equal((decoded.match(/ l S/g) || []).length, 0);
});
