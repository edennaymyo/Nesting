import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneClipOnlyGroups } from '../src/pdf-prune.js';

test('removes an off-artboard clip group that has no painting operators', () => {
  const source = ['q','0 0 100 100 re','W n','Q','10 10 m','20 20 l','S'].join('\n');
  assert.equal(pruneClipOnlyGroups(source), ['10 10 m','20 20 l','S'].join('\n'));
});

test('keeps clipping groups that paint selected artwork', () => {
  const source = ['q','0 0 100 100 re','W n','0 0 20 20 re','f','Q'].join('\n');
  assert.equal(pruneClipOnlyGroups(source), source);
});

test('removes only an empty nested clip from a painted parent group', () => {
  const source = ['q','0 0 20 20 re','f','q','200 0 20 20 re','W n','Q','Q'].join('\n');
  assert.equal(pruneClipOnlyGroups(source), ['q','0 0 20 20 re','f','Q'].join('\n'));
});
