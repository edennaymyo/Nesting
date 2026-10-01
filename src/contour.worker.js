import { runContourAuto } from './contour-auto.js';

self.onmessage = async event => {
  const { id, art, target, sheet, gap, allowRotation } = event.data;
  try {
    const result = await runContourAuto(art, target, sheet, gap, allowRotation, {
      // Keep the interactive worker responsive on wide Epson rolls. The
      // raster-seeded legacy search is synchronous and can monopolize the UI
      // worker for a long time; validated geometric baselines and the bounded
      // exact-vector compact/refill pass remain enabled.
      skipLegacy: true,
      onProgress: phase => self.postMessage({ id, phase }),
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
