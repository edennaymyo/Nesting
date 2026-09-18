import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPostScript } from '../src/eps-import.js';

test('plain EPS keeps its PostScript payload', () => {
  const bytes = new TextEncoder().encode('%!PS-Adobe-3.0 EPSF-3.0\n%%EOF');
  assert.deepEqual(extractPostScript(bytes), bytes);
});

test('DOS EPS extracts only the PostScript segment', () => {
  const ps = new TextEncoder().encode('%!PS-Adobe-3.1 EPSF-3.0\n%%EOF');
  const bytes = new Uint8Array(32 + ps.length + 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0xc6d3d0c5, true);
  view.setUint32(4, 32, true);
  view.setUint32(8, ps.length, true);
  bytes.set(ps, 32);
  assert.deepEqual(extractPostScript(bytes), ps);
});

test('damaged DOS EPS header is rejected', () => {
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0xc6d3d0c5, true);
  view.setUint32(4, 32, true);
  view.setUint32(8, 99, true);
  assert.throws(() => extractPostScript(bytes), /header is damaged/);
});
