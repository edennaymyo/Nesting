import React from 'react';
import { RotateCcw } from 'lucide-react';
import { mediaSplitGuides, mediaSplitLayout, mediaSplitPanelSize } from './media-split.js';

export function MediaSplitControls({ sheet, margins, split, unit, display, internal, onChange, disabled, layout = [], nested = false, dirty = true }) {
  const size = mediaSplitPanelSize(sheet, split, margins), geometry = mediaSplitLayout(sheet, margins, split);
  const panelCopies = layout.filter(item => item.zone === 'panel').length, leftoverCopies = layout.length - panelCopies;
  const panelCounts = geometry.panels.map(panel => layout.filter(item => item.zone === 'panel' && item.panelRow === panel.row && item.panelColumn === panel.column).length);
  const minPanelCopies = panelCounts.length ? Math.min(...panelCounts) : 0, maxPanelCopies = panelCounts.length ? Math.max(...panelCounts) : 0;
  const update = patch => onChange(current => ({ ...current, ...patch }));
  const minPanelSize = unit === 'in' ? 2.54 : 1;
  const setGridCount = (axis, raw) => {
    const dimension = axis === 'columns' ? sheet.w : sheet.h, maxCount = Math.max(1, Math.floor(dimension / minPanelSize));
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const count = Math.max(1, Math.min(maxCount, Math.round(parsed)));
    update(axis === 'columns' ? { panelW: sheet.w / count } : { panelH: sheet.h / count });
  };
  const resetGrid = () => update({ panelW: sheet.w, panelH: sheet.h });
  const dimension = (axis, label, value) => <label className="media-split-dimension">Panel {label.toLowerCase()}<span>
    <input aria-label={`Panel ${label.toLowerCase()}`} type="number" min="0.1" step={unit === 'in' ? '0.1' : '1'} value={display(value)} disabled={disabled} onChange={event => { const parsed = Number(event.target.value); if (Number.isFinite(parsed) && parsed > 0) update({ [axis]: internal(parsed) }); }} />
    <i>{unit}</i></span></label>;
  return <section className="media-split-settings" aria-label="Media split">
    <div className="media-split-heading"><h4>MEDIA SPLIT</h4><button type="button" className={`toggle ${split.enabled ? 'active' : ''}`} role="switch" aria-label="Split media" aria-checked={split.enabled} disabled={disabled} onClick={() => update({ enabled: !split.enabled })}><i /></button></div>
    {split.enabled && <>
      <div className="media-split-dimensions">{dimension('panelW', 'Width', size.w)}{dimension('panelH', 'Height', size.h)}</div>
      <div className="media-split-counts" aria-live="polite">
        <label>Columns<input aria-label="Media split columns" type="number" min="1" max={Math.floor(sheet.w / minPanelSize)} step="1" value={geometry.columns} disabled={disabled} onChange={event => setGridCount('columns', event.target.value)} /></label>
        <label>Rows<input aria-label="Media split rows" type="number" min="1" max={Math.floor(sheet.h / minPanelSize)} step="1" value={geometry.rows} disabled={disabled} onChange={event => setGridCount('rows', event.target.value)} /></label>
        <button type="button" aria-label="Reset media split grid" title="Reset to one panel per media sheet" disabled={disabled} onClick={resetGrid}><RotateCcw size={13}/></button>
        <small>{geometry.panels.length} equal panels</small>
      </div>
      <label className="media-split-clearance">Safe area per side<input aria-label="Media split safe area" type="number" min="0" step={unit === 'in' ? '0.01' : '0.1'} value={display(split.clearance)} disabled={disabled} onChange={event => update({ clearance: Math.max(0, internal(event.target.value) || 0) })} /><span>{unit}</span></label>
      <div className="media-split-remainder" aria-live="polite"><span>Leftover</span><b>{display(geometry.remainderW)} × {display(geometry.remainderH)} {unit}</b>
        <small className="media-split-remainder-detail">{[
          ...geometry.leftovers.reduce((areas, area) => { const key = area.name; const previous = areas.find(item => item.name === key); if (previous) previous.count++; else areas.push({ name: key, w: area.w, h: area.h, count: 1 }); return areas; }, []),
        ].filter(area => area.w > 0.5 && area.h > 0.5).map(area => `${area.name.replace(' remainder', '')} ${display(area.w)} × ${display(area.h)}${area.count > 1 ? ` (${area.count})` : ''}`).join(' · ') || 'No usable leftover area'}</small>
        {nested && !dirty && layout.length > 0 && <small>{`${minPanelCopies === maxPanelCopies ? `${minPanelCopies} copies × ${geometry.panels.length} panels` : `${minPanelCopies}–${maxPanelCopies} copies per panel`} · ${leftoverCopies} leftover · ${panelCopies} in panels`}</small>}
      </div>
      <small className="media-split-help">Drag a trim line to resize every panel. Leftover strips are nested separately.</small>
    </>}
  </section>;
}

export function createMediaSplitOverlay({ sheet, margins, split, onResize, interactive = true }) {
  if (!split.enabled) return null;
  const geometry = mediaSplitLayout(sheet, margins, split), guides = mediaSplitGuides(sheet, split, margins), clearance = Number(split.clearance) || 0;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.classList.add('media-split-overlay');
  svg.setAttribute('viewBox', `0 0 ${sheet.w} ${sheet.h}`); svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${geometry.columns} columns by ${geometry.rows} rows media split preview`);
  for (const panel of geometry.panels) {
    const rect = document.createElementNS(ns, 'rect'), group = document.createElementNS(ns, 'g'), badge = document.createElementNS(ns, 'rect'), label = document.createElementNS(ns, 'text');
    rect.setAttribute('x', panel.x); rect.setAttribute('y', panel.y); rect.setAttribute('width', panel.w); rect.setAttribute('height', panel.h);
    rect.setAttribute('class', 'media-split-panel-outline'); svg.append(rect);
    const inset = Math.max(clearance, margins.left, margins.top), badgeW = Math.min(18, panel.w * .2), badgeH = Math.min(7, panel.h * .1), labelX = panel.x + inset + 2, labelY = panel.y + inset + badgeH;
    badge.setAttribute('x', labelX - 1); badge.setAttribute('y', labelY - badgeH + 1); badge.setAttribute('width', badgeW); badge.setAttribute('height', badgeH); badge.setAttribute('rx', 1.5); badge.setAttribute('class', 'media-split-panel-badge');
    label.setAttribute('x', labelX); label.setAttribute('y', labelY); label.setAttribute('class', 'media-split-panel-label'); label.textContent = `P${panel.row * geometry.columns + panel.column + 1}`;
    group.append(badge, label); svg.append(group);
  }
  for (const area of geometry.leftovers) {
    const group = document.createElementNS(ns, 'g'), rect = document.createElementNS(ns, 'rect'), label = document.createElementNS(ns, 'text');
    rect.setAttribute('x', area.x); rect.setAttribute('y', area.y); rect.setAttribute('width', area.w); rect.setAttribute('height', area.h); rect.setAttribute('class', 'media-split-leftover-area');
    label.setAttribute('x', area.x + area.w / 2); label.setAttribute('y', area.y + area.h / 2); label.setAttribute('class', 'media-split-leftover-label'); label.textContent = 'LEFTOVER';
    group.append(rect, label); svg.append(group);
  }
  for (const [axis, values] of [['x', guides.vertical], ['y', guides.horizontal]]) values.forEach(({ position, start, end }, index) => {
    const group = document.createElementNS(ns, 'g'), band = document.createElementNS(ns, 'line'), visible = document.createElementNS(ns, 'line'), hit = document.createElementNS(ns, 'line');
    group.setAttribute('class', `media-split-guide media-split-guide-${axis}`); group.dataset.guideIndex = index + 1;
    if (axis === 'x') for (const node of [band, visible, hit]) { node.setAttribute('x1', position); node.setAttribute('x2', position); node.setAttribute('y1', start); node.setAttribute('y2', end); }
    else for (const node of [band, visible, hit]) { node.setAttribute('x1', start); node.setAttribute('x2', end); node.setAttribute('y1', position); node.setAttribute('y2', position); }
    band.setAttribute('stroke', '#27aac4'); band.setAttribute('stroke-opacity', '.12'); band.setAttribute('stroke-width', clearance * 2);
    visible.setAttribute('class', 'media-split-visible-line'); hit.setAttribute('class', 'media-split-hit-area');
    group.append(band, visible);
    if (interactive) { hit.dataset.splitAxis = axis; hit.dataset.splitIndex = index + 1; group.append(hit); }
    svg.append(group);
  });
  if (!interactive) return svg;
  let drag = null, pendingResize = null;
  svg.addEventListener('pointerdown', event => {
    const hit = event.target.closest('[data-split-axis]'); if (!hit) return;
    drag = { axis: hit.dataset.splitAxis, index: Number(hit.dataset.splitIndex) }; svg.setPointerCapture(event.pointerId); event.preventDefault();
  });
  svg.addEventListener('pointermove', event => {
    if (!drag) return;
    const rect = svg.getBoundingClientRect(), position = drag.axis === 'x' ? (event.clientX - rect.left) / rect.width * sheet.w : (event.clientY - rect.top) / rect.height * sheet.h;
    const panelSize = Math.max(1, position / drag.index), axis = drag.axis, guides = svg.querySelectorAll(`.media-split-guide-${axis}`), bound = axis === 'x' ? sheet.w : sheet.h;
    pendingResize = { [axis === 'x' ? 'panelW' : 'panelH']: panelSize };
    for (const guide of guides) {
      const next = Math.min(bound, panelSize * Number(guide.dataset.guideIndex));
      for (const line of guide.querySelectorAll('line')) if (axis === 'x') line.setAttribute('x1', next), line.setAttribute('x2', next); else line.setAttribute('y1', next), line.setAttribute('y2', next);
    }
  });
  svg.addEventListener('pointerup', () => { if (pendingResize) onResize(pendingResize); pendingResize = null; drag = null; });
  svg.addEventListener('pointercancel', () => { pendingResize = null; drag = null; });
  return svg;
}
