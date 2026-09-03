const path = require('node:path');

const APP_URL = 'nestcut://app/';
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// The renderer may read only the built frontend, never arbitrary local files.
function assetPath(requestUrl, root) {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== 'nestcut:' || url.host !== 'app' || url.username || url.password) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.includes(':')) return null;
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return target;
  } catch {
    return null;
  }
}

module.exports = { APP_URL, CSP, assetPath };
