import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const { assetPath, CSP } = createRequire(import.meta.url)('../desktop/paths.cjs');
const root = path.resolve('dist');

test('desktop serves only built assets on the fixed app origin', () => {
  assert.equal(assetPath('nestcut://app/', root), path.join(root, 'index.html'));
  assert.equal(assetPath('nestcut://app/assets/worker.js', root), path.join(root, 'assets/worker.js'));
  for (const url of ['file:///etc/passwd', 'https://example.com', 'nestcut://evil/index.html', 'nestcut://user@app/index.html', 'nestcut://app/%2e%2e%2fsecret', 'nestcut://app/%5c..%5csecret', 'nestcut://app/C:%5csecret', 'nestcut://app/%00', 'nestcut://app/%invalid']) {
    assert.equal(assetPath(url, root), null, url);
  }
});

test('desktop CSP allows local PDF/packing workers without remote scripts or eval', () => {
  assert.ok(CSP.includes("worker-src 'self' blob:"));
  assert.ok(CSP.includes("object-src 'none'"));
  assert.ok(!CSP.includes("'unsafe-eval'"));
  assert.ok(!CSP.includes('https:'));
});
