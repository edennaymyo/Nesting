// Run with a Vite dev server in a real browser (Canvas + module Worker required).
// await (await import('/tests/contour-browser.js')).runPackingRegression()
import { packingFixtures } from './packing-fixtures.js';
import { validatedPatternPack, packContour } from '../src/packing-legacy.js';
import { contourRings, validateLayout } from '../src/contour-geometry.js';

function workerPack(request) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../src/contour.worker.js', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Packing worker timed out')); }, 60000);
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    worker.onmessage = ({ data }) => {
      if (data.phase) return;
      finish();
      if (data.error) reject(new Error(data.error)); else resolve(data.result);
    };
    worker.onerror = event => { finish(); reject(new Error(event.message)); };
    worker.postMessage({ id: 1, ...request });
  });
}

export async function runPackingRegression() {
  const results = [], sheet = { w: 72, h: 96 }, target = 100;
  for (const art of packingFixtures) for (const gap of [0, 3.048, 7.62]) {
    const rings = contourRings(art);
    let validBaseline = 0;
    for (const pattern of ['grid', 'staggered', 'honeycomb', 'brick']) for (const angle of [0, 90, 180, 270]) {
      const items = validatedPatternPack(art, target, sheet, gap, pattern, angle);
      const checked = validateLayout(items, rings, sheet, gap);
      if (checked.rejected) throw new Error(`${art.name}, ${pattern}, ${angle}°, gap ${gap}: unsafe Step layout`);
      validBaseline = Math.max(validBaseline, checked.items.length);
    }
    const legacy = packContour(art, target, sheet, gap, true);
    const validLegacyCount = validateLayout(legacy, rings, sheet, gap).items.length;
    const start = performance.now();
    const result = await workerPack({ art, target, sheet, gap, allowRotation: true });
    const checked = validateLayout(result.items, rings, sheet, gap);
    if (checked.rejected || result.items.length < Math.max(validBaseline, validLegacyCount)) {
      throw new Error(`${art.name}, gap ${gap}: unsafe or lower-count Auto result`);
    }
    if (result.baselineCount !== validBaseline) throw new Error('Baseline rotation/pattern coverage changed');
    results.push({ shape: art.name, gap, validBaseline, validLegacyCount, count: result.items.length, method: result.method, ms: Math.round(performance.now() - start) });
  }
  const art = packingFixtures[0];
  const manual = await workerPack({ art, target: 5, sheet, gap: 3.048, allowRotation: false });
  if (manual.items.length !== 5 || manual.items.some(item => item.angle !== 0)) throw new Error('Manual quantity or rotation-off regression');
  console.table(results);
  return results;
}
