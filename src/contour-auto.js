import { validatedPatternPack, packContour, repeatGeometry } from './packing-legacy.js';
import { contourRings, placedShape, placementWithinSheet, shapesConflict, validateLayout, betterLayout, filledArea, envelope } from './contour-geometry.js';

const PATTERNS = ['grid', 'staggered', 'brick'];
const CARDINAL_ANGLES = [0, 90, 180, 270];
const yieldUI = () => new Promise(resolve => setTimeout(resolve, 0));

export function selectBestCandidates(candidates, rings, sheet, gap, maxCandidates = 48) {
  let best = { items: [], method: 'empty', rejected: 0 }, bestEnvelope = Infinity;
  const ranked = [...candidates].sort((a, b) => b.items.length - a.items.length || envelope(a.items) - envelope(b.items)).slice(0, maxCandidates);
  for (const candidate of ranked) {
    const candidateEnvelope = envelope(candidate.items);
    // Validation can only remove placements. Don't run the expensive exact
    // polygon checks for candidates that cannot beat the current valid result.
    if (candidate.items.length < best.items.length) continue;
    if (candidate.items.length === best.items.length && candidateEnvelope >= bestEnvelope - 1e-6) continue;
    const checked = validateLayout(candidate.items, rings, sheet, gap);
    if (betterLayout(checked.items, best.items)) {
      best = { ...candidate, ...checked };
      bestEnvelope = envelope(best.items);
    }
  }
  return best;
}

// Local improvement never changes artwork origin/rotation metadata or discards copies.
// Each accepted move/addition is checked in vector space, not against artwork pixels.
export function compactAndFill(seed, rings, art, target, sheet, gap, allowRotation, { budgetMs = 2000, now = () => performance.now() } = {}) {
  const started = now(), deadline = started + budgetMs, expired = () => now() >= deadline;
  const items = seed.map(item => ({ ...item }));
  const shapes = items.map(item => placedShape(rings, item));
  let moves = 0, added = 0, attempts = 0;
  const fits = (item, shape, skip = -1) => placementWithinSheet(item, shape, sheet) && !shapes.some((other, index) => index !== skip && shapesConflict(shape, other, gap));
  for (const axes of [['y', 'x'], ['x', 'y']]) {
    const order = items.map((_, i) => i).sort((a, b) => items[a][axes[0]] - items[b][axes[0]] || items[a][axes[1]] - items[b][axes[1]]);
    for (const index of order) {
      if (expired()) break;
      for (const axis of axes) for (const step of [4, 1, 0.25]) {
        while (items[index][axis] > 1e-6 && !expired()) {
          const candidate = { ...items[index], [axis]: Math.max(0, items[index][axis] - step) }, shape = placedShape(rings, candidate); attempts++;
          if (!fits(candidate, shape, index)) break;
          items[index] = candidate; shapes[index] = shape; moves++;
        }
      }
    }
  }
  const angles = allowRotation ? [...new Set([0, 90, 180, 270, ...items.map(item => item.angle || 0)])] : [0];
  const templates = angles.map(angle => {
    // Existing arbitrary-angle templates preserve their exact PDF placement origin.
    const item = items.find(p => p.angle === angle);
    return item ? { ...item, x: 0, y: 0 } : { ...repeatGeometry(art, angle), x: 0, y: 0 };
  });
  while (items.length < target && !expired()) {
    let addition = null;
    for (const template of templates) {
      if (expired()) break;
      const local = placedShape(rings, template).bounds;
      // Edge-aligned positions fill residual strips; a coarse scan also probes cavities.
      const xs = new Set([Math.max(0, -local.left)]), ys = new Set([Math.max(0, -local.top)]);
      for (const shape of shapes) {
        xs.add(shape.bounds.right + gap - local.left); xs.add(shape.bounds.left - gap - local.right);
        ys.add(shape.bounds.bottom + gap - local.top); ys.add(shape.bounds.top - gap - local.bottom);
      }
      const sortedX = [...xs].filter(x => x >= 0 && x + template.w <= sheet.w).sort((a, b) => a - b);
      const sortedY = [...ys].filter(y => y >= 0 && y + template.h <= sheet.h).sort((a, b) => a - b);
      const tryAt = (x, y) => {
        const candidate = { ...template, x, y, i: items.length }, shape = placedShape(rings, candidate); attempts++;
        if (!fits(candidate, shape)) return false;
        addition = { candidate, shape }; return true;
      };
      search: for (const y of sortedY) for (const x of sortedX) { if (expired() || tryAt(x, y)) break search; }
      if (!addition && !expired()) {
        const step = Math.max(0.5, Math.min(template.w, template.h) / 12);
        scan: for (let y = 0; y + template.h <= sheet.h; y += step) for (let x = 0; x + template.w <= sheet.w; x += step) { if (expired() || tryAt(x, y)) break scan; }
      }
      if (addition) break;
    }
    if (!addition) break;
    items.push(addition.candidate); shapes.push(addition.shape); added++;
  }
  const improved = betterLayout(items, seed);
  return { items: improved ? items : seed.map(item => ({ ...item })), moves: improved ? moves : 0, added: improved ? added : 0, attempts, timedOut: expired() };
}

export async function runContourAuto(art, target, sheet, gap, allowRotation, options = {}) {
  const rings = contourRings(art);
  if (!rings) throw new Error('A valid closed Cut Line is required for Contour Auto.');
  if (![sheet.w, sheet.h, gap, target].every(Number.isFinite) || sheet.w <= 0 || sheet.h <= 0 || gap < 0 || target < 1) throw new Error('Paper margins leave no usable area or nesting settings are invalid.');
  const progress = options.onProgress || (() => {}), candidates = [];
  const rotationStep = Math.max(1, Math.min(90, Math.floor(Number(options.rotationStep) || 1)));
  const angles = allowRotation ? Array.from({ length: Math.ceil(360 / rotationStep) }, (_, index) => index * rotationStep) : [0];
  for (const angle of angles) {
    progress(`Testing cut angle · ${angle}°`); await yieldUI();
    for (const pattern of PATTERNS) candidates.push({ angle, method: `${pattern} ${angle}° baseline`, items: validatedPatternPack(art, target, sheet, gap, pattern, angle) });
  }
  if (allowRotation && options.includeHoneycomb !== false) for (const angle of CARDINAL_ANGLES) {
    progress(`Comparing honeycomb · ${angle}°`); await yieldUI();
    candidates.push({ angle, method: `honeycomb ${angle}° baseline`, items: validatedPatternPack(art, target, sheet, gap, 'honeycomb', angle) });
  }
  progress('Validating baseline cut gaps and margins'); await yieldUI();
  const baseline = selectBestCandidates(candidates, rings, sheet, gap);
  // The baseline is already vector-validated. Do not validate it again when
  // comparing with the optional raster-seeded legacy search result.
  let best = baseline;
  if (!options.skipLegacy && baseline.items.length < target) {
    progress('Searching contour placements'); await yieldUI();
    const legacy = validateLayout(packContour(art, target, sheet, gap, allowRotation), rings, sheet, gap);
    if (betterLayout(legacy.items, best.items)) best = { method: 'contour search', ...legacy };
  }
  progress(`Compacting ${best.items.length} copies and filling gaps`); await yieldUI();
  const improved = compactAndFill(best.items, rings, art, target, sheet, gap, {
    ...options,
    // Cap the optional quality-refinement phase. The validated baseline and
    // contour search remain intact; callers/tests can still request more time.
    budgetMs: options.budgetMs ?? 250,
  });
  // compactAndFill starts from the validated baseline and checks every accepted
  // move/add against all other exact vector shapes, so a second full validation
  // pass here would repeat the most expensive work without changing the result.
  if (betterLayout(improved.items, best.items)) best = { ...best, items: improved.items, method: `${best.method} + compact/refill` };
  return { items: best.items, method: best.method, baselineCount: baseline.items.length, added: best.items.length - baseline.items.length, compactMoves: improved.moves, timedOut: improved.timedOut, cutArea: filledArea(rings) };
}
