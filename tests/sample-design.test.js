import test from 'node:test';
import assert from 'node:assert/strict';
import { contourRings } from '../src/contour-geometry.js';
import { createSampleDesign } from '../src/sample-design.js';

test('creates a rectangular sample with editable physical dimensions and a closed contour', () => {
  const sample = createSampleDesign({ shape: 'rectangle', width: 70, height: 35 });
  assert.deepEqual([sample.w, sample.h], [70, 35]);
  assert.equal(sample.contour.d.endsWith('Z'), true);
  assert.equal(contourRings(sample)[0].length, 4);
});

test('creates a circle sample with a closed cubic contour and equal diameter axes', () => {
  const sample = createSampleDesign({ shape: 'circle', width: 42, height: 42 });
  assert.equal(sample.w, sample.h);
  assert.match(sample.contour.d, /C/);
  assert.equal(sample.contour.d.endsWith('Z'), true);
  assert.equal(contourRings(sample)[0].length > 20, true);
});

test('rejects unsupported sample shapes and out-of-range dimensions', () => {
  assert.throws(() => createSampleDesign({ shape: 'oval' }), /Choose a rectangle or circle/);
  assert.throws(() => createSampleDesign({ width: 0 }), /between 1 and 3000/);
});
