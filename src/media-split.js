import { centerLayout } from './layout-center.js';

export const DEFAULT_MEDIA_SPLIT = Object.freeze({
  enabled: true,
  panelW: null,
  panelH: null,
  clearance: 6.35,
});

const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;

function splitMetrics(sheet, margins, split) {
  const panelW = positive(split.panelW) ? Number(split.panelW) : sheet.w;
  const panelH = positive(split.panelH) ? Number(split.panelH) : sheet.h;
  // Panel dimensions describe trim-to-trim physical size; outer margins and
  // split clearances only shrink the artwork-safe area inside each region.
  const availableW = Math.max(0, sheet.w);
  const availableH = Math.max(0, sheet.h);
  const columns = Math.floor((availableW + 1e-6) / panelW);
  const rows = Math.floor((availableH + 1e-6) / panelH);
  return { panelW, panelH, availableW, availableH, columns, rows, remainderW: availableW - columns * panelW, remainderH: availableH - rows * panelH };
}

export function mediaSplitLayout(sheet, margins, split = DEFAULT_MEDIA_SPLIT) {
  const clearance = Math.max(0, Number(split.clearance) || 0);
  const metrics = splitMetrics(sheet, margins, split);
  const { panelW, panelH, columns, rows, remainderW, remainderH } = metrics;
  const panels = [];
  const panelInsetX = split.enabled ? Math.max(clearance, margins.left, margins.right) : null;
  const panelInsetY = split.enabled ? Math.max(clearance, margins.top, margins.bottom) : null;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = column * panelW, y = row * panelH;
    const left = split.enabled ? panelInsetX : column === 0 ? margins.left : clearance;
    const right = split.enabled ? panelInsetX : column < columns - 1 || remainderW > 1e-6 ? clearance : margins.right;
    const top = split.enabled ? panelInsetY : row === 0 ? margins.top : clearance;
    const bottom = split.enabled ? panelInsetY : row < rows - 1 || remainderH > 1e-6 ? clearance : margins.bottom;
    panels.push({ type: 'panel', row, column, x, y, w: panelW, h: panelH, usable: { x: x + left, y: y + top, w: panelW - left - right, h: panelH - top - bottom } });
  }

  const leftovers = [];
  if (remainderW > 1e-6 && columns > 0) {
    const x = columns * panelW, y = 0, w = remainderW, h = sheet.h;
    leftovers.push({ type: 'leftover-vertical', name: 'Right remainder', x, y, w, h, usable: { x: x + clearance, y: y + margins.top, w: w - clearance - margins.right, h: h - margins.top - margins.bottom } });
  }
  if (remainderH > 1e-6 && rows > 0 && columns > 0) {
    const x = 0, y = rows * panelH, w = columns * panelW, h = remainderH;
    leftovers.push({ type: 'leftover-horizontal', name: 'Bottom remainder', x, y, w, h, usable: { x: x + margins.left, y: y + clearance, w: w - margins.left - margins.right, h: h - clearance - margins.bottom } });
  }
  return { ...metrics, panels, leftovers, regions: [...panels, ...leftovers] };
}

export function mediaSplitGuides(sheet, split = DEFAULT_MEDIA_SPLIT, margins = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const layout = mediaSplitLayout(sheet, margins, split);
  const vertical = Array.from({ length: Math.max(0, layout.columns - 1) }, (_, index) => ({ position: (index + 1) * layout.panelW, start: 0, end: layout.rows * layout.panelH }));
  const horizontal = Array.from({ length: Math.max(0, layout.rows - 1) }, (_, index) => ({ position: (index + 1) * layout.panelH, start: 0, end: layout.columns * layout.panelW }));
  if (layout.columns > 0 && layout.remainderW > 1e-6) vertical.push({ position: layout.columns * layout.panelW, start: 0, end: sheet.h });
  if (layout.rows > 0 && layout.remainderH > 1e-6) horizontal.push({ position: layout.rows * layout.panelH, start: 0, end: layout.columns * layout.panelW });
  return { vertical, horizontal };
}

export function mediaSplitPanelSize(sheet, split = DEFAULT_MEDIA_SPLIT, margins = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const { panelW: w, panelH: h } = splitMetrics(sheet, margins, split);
  return { w, h };
}

// The disjoint safe regions cannot hold more copies than their total area
// divided by the actual filled Cut Line area. This gives Fill Sheet a
// geometry-based search ceiling instead of an arbitrary copy-count cap.
export function mediaSplitFillTarget(regions, cutArea) {
  if (!positive(cutArea)) return 1;
  const safeArea = regions.reduce((total, region) => total + Math.max(0, region.usable.w) * Math.max(0, region.usable.h), 0);
  return Math.max(1, Math.floor(safeArea / Number(cutArea)));
}

export async function packAcrossMediaPanels(regions, target, pack) {
  const candidates = new Map();
  for (const region of regions) {
    if (region.usable.w <= 0 || region.usable.h <= 0) continue;
    const key = `${region.usable.w.toFixed(5)}:${region.usable.h.toFixed(5)}`;
    if (!candidates.has(key)) candidates.set(key, await pack({ w: region.usable.w, h: region.usable.h }, target));
  }
  const selected = regions.map(region => {
    const key = `${region.usable.w.toFixed(5)}:${region.usable.h.toFixed(5)}`;
    return { region, items: candidates.get(key) || [] };
  });
  let count = 0;
  const packedRegions = [];
  // Repeat a complete best-fit panel plan, rather than round-robin scattering
  // a partial plan across every equal panel. This keeps panels consistent and
  // avoids leaving easy-to-fill space in each one.
  for (const { region, items } of selected) {
    if (count >= target) break;
    const centeredPlan = centerLayout(items, region.usable);
    const tolerance = 0.05;
    if (centeredPlan.some(item => item.x < -tolerance || item.y < -tolerance || item.x + item.w > region.usable.w + tolerance || item.y + item.h > region.usable.h + tolerance)) {
      throw new Error(`Nesting returned a cut outside the ${region.name || 'media panel'} safe area.`);
    }
    const placements = centeredPlan.slice(0, target - count).map(item => ({ ...item, i: count++, zone: region.type, zoneName: region.name, panelRow: region.row, panelColumn: region.column }));
    if (placements.length) packedRegions.push({ region, items: placements });
  }
  return packedRegions.flatMap(({ region, items }) => items.map(item => ({
    ...item,
    x: item.x + region.usable.x,
    y: item.y + region.usable.y,
  })));
}
