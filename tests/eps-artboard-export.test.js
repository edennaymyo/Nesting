import test from 'node:test';
import assert from 'node:assert/strict';
import { epsArtboardArguments } from '../src/eps-import.js';

test('builds a fixed-media EPS conversion for only the selected artboard', () => {
  const args = epsArtboardArguments('/input.eps', '/output.pdf', [367.605, 0, 735.21, 247.48]);
  assert.ok(args.includes('-dFIXEDMEDIA'));
  assert.ok(args.includes('-dDEVICEWIDTHPOINTS=367.605'));
  assert.ok(args.includes('-dDEVICEHEIGHTPOINTS=247.48'));
  assert.ok(args.includes('<</PageOffset [-367.605 0]>> setpagedevice'));
  assert.equal(args.at(-1), '/input.eps');
  assert.equal(args.includes('-dEPSCrop'), false);
});

test('rejects an invalid EPS artboard crop', () => {
  assert.throws(() => epsArtboardArguments('/input.eps', '/output.pdf', [40, 0, 20, 100]), /invalid crop box/);
});
