import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import { boxFromInsets, insetsFromBox, reflectBox, validBox, moveBox, drawRegistrationBox } from '../src/registration-box.js';

const sheet = { w: 330.2, h: 482.6 };
const box = { x: 12.7, y: 25.4, w: 280, h: 400 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('insets and full-sheet horizontal reflection preserve dimensions', () => {
  const roundTrip = boxFromInsets(sheet, insetsFromBox(sheet, box));
  for (const key of Object.keys(box)) near(roundTrip[key], box[key]);
  const back = reflectBox(sheet, box);
  near(back.x + back.w + box.x, sheet.w);
  assert.equal(back.y, box.y);
  for (const key of Object.keys(box)) near(reflectBox(sheet, back)[key], box[key]);
});
test('drag clamps to paper, without mutating input or dimensions', () => {
  const copy = { ...box };
  assert.deepEqual(moveBox(sheet, box, 'move', -1000, -1000), { ...box, x: 0, y: 0 });
  const moved = moveBox(sheet, box, 'move', 1000, 1000);
  near(moved.x + moved.w, sheet.w); near(moved.y + moved.h, sheet.h);
  assert.deepEqual(box, copy);
});
test('all eight resize handles stay valid, cannot cross edges', () => {
  for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    for (const delta of [-1000, -10, 0, 10, 1000]) assert.ok(validBox(sheet, moveBox(sheet, box, handle, delta, delta)));
  }
});
test('reject invalid, inverted, outside-paper and non-finite boxes', () => {
  for (const bad of [{...box,w:0},{...box,x:-1},{...box,h:999},{...box,x:NaN},{...box,y:Infinity}]) assert.equal(validBox(sheet,bad),false);
});
test('PDF export adds one unfilled closed path per page, mirrored around paper', async () => {
  const pdf = await PDFDocument.create();
  const front = pdf.addPage([936, 1368]), back = pdf.addPage([936, 1368]);
  drawRegistrationBox(front, sheet, box);
  drawRegistrationBox(back, sheet, reflectBox(sheet, box));
  const loaded = await PDFDocument.load(await pdf.save());
  const content = loaded.getPages().map(page => {
    const streams = page.node.Contents();
    return Array.from({length:streams.size()},(_,i)=>Buffer.from(decodePDFRawStream(streams.lookup(i)).decode()).toString()).join('');
  });
  for (const stream of content) {
    assert.equal(stream.match(/^h$/gm)?.length,1);
    assert.equal(stream.match(/^S$/gm)?.length,1);
    assert.doesNotMatch(stream,/^(f|f\*|B|B\*)$/m);
    assert.doesNotMatch(stream,/CutContour|Cut Line/);
  }
  assert.notEqual(content[0],content[1]);
  assert.throws(()=>drawRegistrationBox(front,sheet,{...box,w:999}));
});
