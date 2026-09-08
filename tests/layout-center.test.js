import test from 'node:test';
import assert from 'node:assert/strict';
import { centerLayout, DEFAULT_GAP_MM, DEFAULT_MARGINS_MM } from '../src/layout-center.js';

const envelope = items => ({
  left: Math.min(...items.map(item => item.x)),
  top: Math.min(...items.map(item => item.y)),
  right: Math.max(...items.map(item => item.x + item.w)),
  bottom: Math.max(...items.map(item => item.y + item.h)),
});

test('default margins reserve 0.9in at top and 0.5in on other sides', () => {
  assert.deepEqual(DEFAULT_MARGINS_MM, { top: 22.86, right: 12.7, bottom: 12.7, left: 12.7 });
});

test('default cut-to-cut gap is 0.2in', () => {
  assert.equal(DEFAULT_GAP_MM, 5.08);
  assert.equal(DEFAULT_GAP_MM / 25.4, 0.2);
});

test('centers the full cut-bound envelope inside an asymmetric usable area', () => {
  const source = [
    { i: 0, x: 0, y: 0, w: 20, h: 30, angle: 0 },
    { i: 1, x: 24, y: 7, w: 10, h: 8, angle: 90 },
  ];
  const centered = centerLayout(source, { w: 100, h: 80 });
  const box = envelope(centered);
  assert.equal((box.left + box.right) / 2, 50);
  assert.equal((box.top + box.bottom) / 2, 40);
  assert.equal(centered[1].x - centered[0].x, 24);
  assert.equal(centered[1].y - centered[0].y, 7);
  assert.equal(centered[1].angle, 90);
  assert.deepEqual(source[0], { i: 0, x: 0, y: 0, w: 20, h: 30, angle: 0 });
});

test('empty layouts remain empty', () => {
  assert.deepEqual(centerLayout([], { w: 100, h: 80 }), []);
});
