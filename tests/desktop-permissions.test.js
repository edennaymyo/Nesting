import test from 'node:test';
import assert from 'node:assert/strict';
import permissions from '../desktop/permissions.cjs';

const trusted = { getURL:()=> 'nestcut://app/' };

test('desktop grants only local-font enumeration to the trusted app origin',()=>{
  assert.equal(permissions.allowsPermission(trusted,'local-fonts'),true);
  assert.equal(permissions.allowsPermission(trusted,'camera'),false);
  assert.equal(permissions.allowsPermission({getURL:()=> 'https://example.com'},'local-fonts'),false);
});
