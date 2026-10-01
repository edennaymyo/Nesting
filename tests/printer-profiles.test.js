import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EPSON_GAP_MM, DEFAULT_EPSON_MARK_LENGTH_MM, DEFAULT_EPSON_MARGINS_MM, DEFAULT_EPSON_MEDIA_SIZE, DEFAULT_KONICA_MARK_LENGTH_MM, EPSON_MEDIA_SIZES, PRINTERS, epsonMediaSize } from '../src/printer-profiles.js';

test('printer profiles name Konica and Epson separately', () => {
  assert.equal(PRINTERS.konica.label, 'Konica Digital Press');
  assert.equal(PRINTERS.epson.label, 'Epson SureColor S80670');
});

test('Epson offers both requested landscape roll media sizes and defaults to the larger preview', () => {
  assert.deepEqual(EPSON_MEDIA_SIZES.map(({ id }) => id), ['49x24.5', '59x25.1']);
  assert.ok(EPSON_MEDIA_SIZES.every(({ w, h }) => w > h));
  assert.equal(DEFAULT_EPSON_MEDIA_SIZE, '59x25.1');
  assert.equal(epsonMediaSize('unknown').id, DEFAULT_EPSON_MEDIA_SIZE);
  assert.ok(Math.abs(epsonMediaSize('49x24.5').w / 25.4 - 49) < 1e-9);
  assert.ok(Math.abs(epsonMediaSize('49x24.5').h / 25.4 - 24.5) < 1e-9);
  assert.ok(Math.abs(epsonMediaSize('59x25.1').w / 25.4 - 59) < 1e-9);
  assert.ok(Math.abs(epsonMediaSize('59x25.1').h / 25.4 - 25.1) < 1e-9);
});

test('Epson defaults to 0.25in margins, 2 mm cut gap and 10 mm marks; Konica keeps 5 mm marks', () => {
  assert.deepEqual(DEFAULT_EPSON_MARGINS_MM, { top: 6.35, right: 6.35, bottom: 6.35, left: 6.35 });
  assert.equal(DEFAULT_EPSON_GAP_MM, 2);
  assert.equal(DEFAULT_EPSON_MARK_LENGTH_MM, 10);
  assert.equal(DEFAULT_KONICA_MARK_LENGTH_MM, 5);
});
