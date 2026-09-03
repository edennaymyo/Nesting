import { runContourAuto } from './contour-auto.js';

self.onmessage = async event => {
  const { id, art, target, sheet, gap, allowRotation } = event.data;
  try {
    const result = await runContourAuto(art, target, sheet, gap, allowRotation, {
      onProgress: phase => self.postMessage({ id, phase }),
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
