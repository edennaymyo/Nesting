import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCutContour } from '../src/cut-contour-selection.js';

const closed = (stroke, d, points) => ({ stroke, d, points, closed: true });
const open = (stroke, d, points) => ({ stroke, d, points, closed: false });

test('dimension leaders cannot outrank a closed Cut Line', () => {
  const dimensions = Array.from({ length: 8 }, (_, index) =>
    open('#db3425', `M${index} 0 L${index + 1} 0`, [[index, 0], [index + 1, 0]]));
  const cut = [
    closed('#fb3199', 'M10 10 L110 10 L110 90 L10 90 Z', [[10, 10], [110, 10], [110, 90], [10, 90]]),
    closed('#fb3199', 'M50 40 C60 40 60 50 50 50 C40 50 40 40 50 40 Z', [[50, 40], [60, 40], [60, 50], [50, 50], [40, 50], [40, 40]])
  ];
  const result = selectCutContour([...dimensions, ...cut], [288, 288]);
  assert.ok(result);
  assert.equal(result.selected.length, 2);
  assert.ok(result.selected.every(candidate => candidate.stroke === '#fb3199'));
  assert.deepEqual(result.box, [10, 10, 100, 80]);
});

test('returns null when a PDF contains only open measurement paths', () => {
  assert.equal(selectCutContour([
    open('#db3425', 'M0 0 L100 0', [[0, 0], [100, 0]])
  ], [288, 288]), null);
});
