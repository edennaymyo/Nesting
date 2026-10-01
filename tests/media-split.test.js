import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MEDIA_SPLIT, mediaSplitFillTarget, mediaSplitGuides, mediaSplitLayout, mediaSplitPanelSize, packAcrossMediaPanels } from '../src/media-split.js';

const sheet = { w: 59 * 25.4, h: 25.1 * 25.4 };
const margins = { top: 6.35, right: 6.35, bottom: 6.35, left: 6.35 };

test('media split defaults to one full-media panel with quarter-inch clearance', () => {
  assert.deepEqual(DEFAULT_MEDIA_SPLIT, { enabled: true, panelW: null, panelH: null, clearance: 6.35 });
  const geometry = mediaSplitLayout(sheet, margins);
  assert.equal(geometry.panels.length, 1);
  assert.equal(geometry.panels[0].usable.x, 6.35);
  assert.equal(geometry.panels[0].usable.y, 6.35);
  assert.ok(Math.abs(geometry.panels[0].usable.w - (sheet.w - 12.7)) < 1e-8);
  assert.ok(Math.abs(geometry.panels[0].usable.h - (sheet.h - 12.7)) < 1e-8);
  assert.deepEqual(mediaSplitGuides(sheet), { vertical: [], horizontal: [] });
  assert.deepEqual(mediaSplitPanelSize(sheet), sheet);
});

test('entered panel dimensions determine equal dynamic rows and columns', () => {
  const split = { enabled: true, panelW: sheet.w / 5, panelH: sheet.h / 2, clearance: 6.35 };
  const geometry = mediaSplitLayout(sheet, margins, split);
  assert.equal(geometry.columns, 5);
  assert.equal(geometry.rows, 2);
  assert.equal(geometry.panels.length, 10);
  assert.ok(geometry.panels.every(panel => Math.abs(panel.w - split.panelW) < 1e-8));
  assert.ok(geometry.panels.every(panel => Math.abs(panel.h - split.panelH) < 1e-8));
  assert.ok(geometry.panels.every(panel => Math.abs(panel.usable.w - (split.panelW - 12.7)) < 1e-8));
  assert.ok(geometry.panels.every(panel => Math.abs(panel.usable.h - (split.panelH - 12.7)) < 1e-8));
  assert.deepEqual(mediaSplitGuides(sheet, split, margins), {
    vertical: [1, 2, 3, 4].map(index => ({ position: split.panelW * index, start: 0, end: split.panelH * 2 })),
    horizontal: [{ position: split.panelH, start: 0, end: split.panelW * 5 }],
  });
});

test('Fill Sheet target is bounded by available Cut Line area, not a fixed copy cap', () => {
  const geometry = mediaSplitLayout({ w: 1000, h: 500 }, margins, { enabled: true, panelW: 200, panelH: 250, clearance: 6.35 });
  const target = mediaSplitFillTarget(geometry.regions, 100);
  const safeArea = geometry.regions.reduce((sum, region) => sum + region.usable.w * region.usable.h, 0);
  assert.equal(target, Math.floor(safeArea / 100));
  assert.ok(target > 500);
  assert.equal(mediaSplitFillTarget(geometry.regions, 0), 1);
});

test('Fill Sheet keeps packing all panels after more than 500 theoretical copies', async () => {
  const geometry = mediaSplitLayout({ w: 200, h: 100 }, { top: 0, right: 0, bottom: 0, left: 0 }, { enabled: true, panelW: 100, panelH: 50, clearance: 1 });
  const target = mediaSplitFillTarget(geometry.regions, 1);
  let packCalls = 0;
  const items = await packAcrossMediaPanels(geometry.regions, target, async area => {
    packCalls++;
    assert.ok(area.w * area.h > 1);
    return Array.from({ length: 60 }, (_, index) => ({ x: index % 10 * 8, y: Math.floor(index / 10) * 8, w: 7, h: 7 }));
  });
  assert.ok(target > 500);
  assert.equal(packCalls, 1); // identical panel safe areas share one calculation
  assert.equal(items.length, 240); // all four equal panels receive their full 60-copy plan
  assert.deepEqual(new Set(items.map(item => `${item.panelRow}:${item.panelColumn}`)).size, 4);
});

test('leftover strips and their shared corner become separate safe packing zones', () => {
  const geometry = mediaSplitLayout({ w: 100, h: 60 }, { top: 5, right: 5, bottom: 5, left: 5 }, { panelW: 30, panelH: 25, clearance: 4 });
  assert.equal(geometry.columns, 3);
  assert.equal(geometry.rows, 2);
  assert.equal(geometry.remainderW, 10);
  assert.equal(geometry.remainderH, 10);
  assert.equal(geometry.panels.length, 6);
  assert.equal(geometry.leftovers.length, 2); // one continuous strip on each axis; the corner is part of the right strip
  assert.deepEqual(geometry.leftovers.map(area => area.name).reduce((counts, name) => ({ ...counts, [name]: (counts[name] || 0) + 1 }), {}), {
    'Right remainder': 1, 'Bottom remainder': 1,
  });
  assert.ok(geometry.regions.every(region => region.usable.w > 0 && region.usable.h > 0));
  assert.deepEqual(mediaSplitGuides({ w: 100, h: 60 }, { panelW: 30, panelH: 25 }, { top: 5, right: 5, bottom: 5, left: 5 }), {
    vertical: [{ position: 30, start: 0, end: 50 }, { position: 60, start: 0, end: 50 }, { position: 90, start: 0, end: 60 }],
    horizontal: [{ position: 25, start: 0, end: 90 }, { position: 50, start: 0, end: 90 }],
  });
});

test('oversized panel yields zero complete panels and too-small safe regions do not reach packing', () => {
  const geometry = mediaSplitLayout({ w: 100, h: 100 }, margins, { panelW: 101, panelH: 101, clearance: 0 });
  assert.equal(geometry.columns, 0);
  assert.equal(geometry.rows, 0);
  const narrow = mediaSplitLayout({ w: 100, h: 100 }, margins, { panelW: 15, panelH: 15, clearance: 100 });
  assert.ok(narrow.panels.every(({ usable }) => usable.w <= 0 && usable.h <= 0));
});

test('packing is isolated, centered, balanced, and reuses equal region geometry', async () => {
  const geometry = mediaSplitLayout({ w: 200, h: 100 }, { top: 0, right: 0, bottom: 0, left: 0 }, { enabled: true, panelW: 100, panelH: 100, clearance: 10 });
  let packCalls = 0;
  const items = await packAcrossMediaPanels(geometry.regions, 3, async area => {
    packCalls++;
    assert.deepEqual(area, { w: 80, h: 80 });
    return [{ x: 0, y: 0, w: 20, h: 20 }, { x: 30, y: 0, w: 20, h: 20 }];
  });
  assert.equal(packCalls, 1);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map(item => item.i), [0, 1, 2]);
  assert.ok(items.every(item => item.x >= 0 && item.x + item.w <= 200));
  assert.ok(items.every(item => item.zone === 'panel'));
  const local = column => {
    const origin = geometry.panels.find(panel => panel.column === column).usable;
    return items.filter(item => item.panelColumn === column).map(item => [item.x - origin.x, item.y - origin.y]);
  };
  assert.deepEqual(local(1), local(0).slice(0, 1)); // a partial last panel keeps the shared full-panel alignment
});

test('leftover strips are independently packed and tagged separately from equal panels', async () => {
  const geometry = mediaSplitLayout({ w: 100, h: 60 }, { top: 0, right: 0, bottom: 0, left: 0 }, { panelW: 30, panelH: 25, clearance: 1 });
  const items = await packAcrossMediaPanels(geometry.regions, 145, async area => {
    const columns = Math.floor(area.w / 5), rows = Math.floor(area.h / 5);
    return Array.from({ length: columns * rows }, (_, index) => ({ x: index % columns * 5, y: Math.floor(index / columns) * 5, w: 4, h: 4 }));
  });
  assert.equal(items.length, 145);
  assert.ok(items.some(item => item.zone === 'panel'));
  assert.ok(items.some(item => item.zone.startsWith('leftover-')));
  assert.ok(items.filter(item => item.zone.startsWith('leftover-')).every(item => item.zoneName));
});

test('one geometry calculation is replicated across equal panels and two continuous leftover strips', async () => {
  const geometry = mediaSplitLayout({ w: 100, h: 60 }, { top: 0, right: 0, bottom: 0, left: 0 }, { enabled: true, panelW: 30, panelH: 25, clearance: 1 });
  let packCalls = 0;
  const items = await packAcrossMediaPanels(geometry.regions, 10, async area => {
    packCalls++;
    if (area.w > 20 && area.h > 20) return [{ x: 0, y: 0, w: 4, h: 4 }];
    if (area.w < 20) return Array.from({ length: 3 }, (_, index) => ({ x: 0, y: index * 5, w: 4, h: 4 }));
    return Array.from({ length: 3 }, (_, index) => ({ x: index * 5, y: 0, w: 4, h: 4 }));
  });
  assert.equal(packCalls, 3); // equal panels, right strip, bottom strip
  assert.equal(items.length, 10);
  assert.equal(items.filter(item => item.zone === 'panel').length, 6);
  assert.equal(items.filter(item => item.zone === 'leftover-vertical').length, 3);
  assert.equal(items.filter(item => item.zone === 'leftover-horizontal').length, 1);
  const firstPanel = items.filter(item => item.zone === 'panel' && item.panelRow === 0 && item.panelColumn === 0);
  const secondPanel = items.filter(item => item.zone === 'panel' && item.panelRow === 0 && item.panelColumn === 1);
  assert.equal(firstPanel.length, 1);
  assert.equal(secondPanel.length, 1);
  const panelOrigin = (row, column) => geometry.panels.find(panel => panel.row === row && panel.column === column).usable;
  assert.deepEqual(firstPanel.map(({ x, y }) => [x - panelOrigin(0, 0).x, y - panelOrigin(0, 0).y]), secondPanel.map(({ x, y }) => [x - panelOrigin(0, 1).x, y - panelOrigin(0, 1).y]));
});

test('packing rejects any candidate that crosses its panel safe area', async () => {
  const geometry = mediaSplitLayout({ w: 200, h: 100 }, { top: 0, right: 0, bottom: 0, left: 0 }, { enabled: true, panelW: 100, panelH: 100, clearance: 10 });
  await assert.rejects(
    packAcrossMediaPanels(geometry.regions, 1, async () => [{ x: 0, y: 0, w: 90, h: 20 }]),
    /outside the media panel safe area/,
  );
});
