// Vector-space validation for Auto. Step & Repeat placement remains unchanged.
// Cubics are adaptively flattened with <= 0.01 mm control-point flatness.
export const FLATNESS_MM = 0.01;
export const GAP_TOLERANCE_MM = 0.03;
export const MARGIN_TOLERANCE_MM = 0.03;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const oppositeSides = (u, v) => u > 1e-9 && v < -1e-9 || u < -1e-9 && v > 1e-9;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function flattenCubic(a, b, c, d, result, depth = 0) {
  if (depth >= 18 || Math.max(pointSegment(b, a, d), pointSegment(c, a, d)) <= FLATNESS_MM) { result.push(d); return; }
  const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d), abc = midpoint(ab, bc), bcd = midpoint(bc, cd), mid = midpoint(abc, bcd);
  flattenCubic(a, ab, abc, mid, result, depth + 1);
  flattenCubic(mid, bcd, cd, d, result, depth + 1);
}
export function contourRings(art) {
  if (!art?.contour?.d) return null;
  const [bx, by, bw, bh] = art.contour.box, [mx, my, mw, mh] = art.contour.mmBox || [0, 0, art.w, art.h];
  if (![bx, by, bw, bh, mx, my, mw, mh].every(Number.isFinite) || bw <= 0 || bh <= 0) return null;
  const tokens = art.contour.d.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
  const rings = []; let ring = [], i = 0;
  // Use the same artwork scale as buildOutputPdf, including imported page rounding.
  const sx = art.box ? art.w / ((art.box[2] - art.box[0]) * 25.4 / 72) : 1;
  const sy = art.box ? art.h / ((art.box[3] - art.box[1]) * 25.4 / 72) : 1;
  const point = () => [(mx + (Number(tokens[i++]) - bx) * mw / bw) * sx, (my + (by + bh - Number(tokens[i++])) * mh / bh) * sy];
  const close = () => { if (ring.length > 2) { if (distance(ring[0], ring.at(-1)) < 1e-9) ring.pop(); rings.push(ring); } ring = []; };
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') { close(); ring.push(point()); }
    else if (command === 'L') ring.push(point());
    else if (command === 'C' && ring.length) { const a = ring.at(-1), b = point(), c = point(), d = point(); flattenCubic(a, b, c, d, ring); }
    else if (command === 'Z') close();
    else return null;
  }
  close();
  return rings.length && rings.every(r => r.every(p => p.every(Number.isFinite))) ? rings : null;
}
function signedArea(ring) { let sum = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; sum += a[0] * b[1] - b[0] * a[1]; } return sum / 2; }
function winding(point, rings) {
  let n = 0;
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a[1] <= point[1] && b[1] > point[1] && cross(a, b, point) > 0) n++;
    if (a[1] > point[1] && b[1] <= point[1] && cross(a, b, point) < 0) n--;
  }
  return n;
}
export function filledArea(rings) {
  if (!rings) return null;
  // Nonzero fill: same-direction nested rings do not double-count material.
  return Math.abs(rings.reduce((sum, ring, index) => {
    const area = signedArea(ring);
    const ancestors = rings.filter((other, j) => j !== index && Math.abs(signedArea(other)) > Math.abs(area) && winding(ring[0], [other]) !== 0);
    const before = ancestors.reduce((s, r) => s + Math.sign(signedArea(r)), 0), after = before + Math.sign(area);
    return sum + Math.abs(area) * (Number(after !== 0) - Number(before !== 0));
  }, 0));
}
export function cutUsage(count, area, sheet) {
  if (!Number.isFinite(area) || sheet.w <= 0 || sheet.h <= 0) return null;
  return Math.min(100, Math.max(0, count * area / (sheet.w * sheet.h) * 100));
}
function boundsOf(rings) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  return { left, top, right, bottom };
}
export function placedShape(rings, item) {
  const radians = (item.angle || 0) * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  const turned = rings.map(ring => ring.map(([x, y]) => [item.x + x * c - y * s - (item.pdfMinX || 0), item.y + item.h + (item.pdfMinY || 0) - x * s - y * c]));
  const edges = turned.flatMap(ring => ring.map((point, i) => [point, ring[(i + 1) % ring.length]]));
  return { rings: turned, edges, bounds: boundsOf(turned) };
}
function strictInside(point, shape) {
  if (!winding(point, shape.rings)) return false;
  return shape.edges.every(([a, b]) => pointSegment(point, a, b) > 1e-7);
}
export function shapesConflict(a, b, gap) {
  const A = a.bounds, B = b.bounds, required = Math.max(0, gap - GAP_TOLERANCE_MM);
  if (A.right + required < B.left || B.right + required < A.left || A.bottom + required < B.top || B.bottom + required < A.top) return false;
  const alignedEdges = [];
  for (const [p, q] of a.edges) for (const [r, s] of b.edges) {
    if (Math.max(p[0], q[0]) + required < Math.min(r[0], s[0]) || Math.max(r[0], s[0]) + required < Math.min(p[0], q[0]) || Math.max(p[1], q[1]) + required < Math.min(r[1], s[1]) || Math.max(r[1], s[1]) + required < Math.min(p[1], q[1])) continue;
    // Test each orientation independently. Multiplying a long edge by a tiny
    // floating-point error otherwise mistakes cardinal-angle contact for crossing.
    if (oppositeSides(cross(p,q,r),cross(p,q,s)) && oppositeSides(cross(r,s,p),cross(r,s,q))) return true;
    if (required && Math.min(pointSegment(p, r, s), pointSegment(q, r, s), pointSegment(r, p, q), pointSegment(s, p, q)) < required) return true;
    if (Math.abs(cross(p, q, r)) < 1e-8 && Math.abs(cross(p, q, s)) < 1e-8) {
      const dx = q[0] - p[0], dy = q[1] - p[1], length2 = dx * dx + dy * dy;
      if (length2) {
        const tr = ((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / length2, ts = ((s[0] - p[0]) * dx + (s[1] - p[1]) * dy) / length2;
        const start = Math.max(0, Math.min(tr, ts)), end = Math.min(1, Math.max(tr, ts));
        if (end > start) alignedEdges.push([[p[0] + start * dx, p[1] + start * dy], [p[0] + end * dx, p[1] + end * dy]]);
      }
    }
  }
  if (A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top) return false;
  if (a.rings.some(r => r.some(p => strictInside(p, b))) || b.rings.some(r => r.some(p => strictInside(p, a)))) return true;
  // Aligned/coincident contours may have no strictly crossing edges or interior vertices.
  for (const [p, q] of alignedEdges) {
    const length = distance(p, q); if (length < 1e-7) continue;
    const m = midpoint(p, q), dx = (q[1] - p[1]) / length * 1e-5, dy = (p[0] - q[0]) / length * 1e-5;
    for (const sign of [-1, 1]) { const sample = [m[0] + sign * dx, m[1] + sign * dy]; if (strictInside(sample, a) && strictInside(sample, b)) return true; }
  }
  return false;
}
export function withinSheet(shape, sheet) {
  const b = shape.bounds, e = MARGIN_TOLERANCE_MM;
  return [b.left, b.top, b.right, b.bottom].every(Number.isFinite) && b.left >= -e && b.top >= -e && b.right <= sheet.w + e && b.bottom <= sheet.h + e;
}
export function validateLayout(items, rings, sheet, gap) {
  const accepted = [], shapes = []; let rejected = 0;
  for (const item of items) {
    const shape = placedShape(rings, item);
    if (!placementWithinSheet(item, shape, sheet) || shapes.some(other => shapesConflict(shape, other, gap))) { rejected++; continue; }
    accepted.push({ ...item, i: accepted.length }); shapes.push(shape);
  }
  return { items: accepted, shapes, rejected };
}
export function placementWithinSheet(item, shape, sheet) {
  const e = MARGIN_TOLERANCE_MM;
  return Number.isFinite(item.w) && Number.isFinite(item.h) && item.w > 0 && item.h > 0 && item.x >= -e && item.y >= -e && item.x + item.w <= sheet.w + e && item.y + item.h <= sheet.h + e && withinSheet(shape, sheet);
}
export function envelope(items) {
  if (!items.length) return Infinity;
  const left = Math.min(...items.map(p => p.x)), top = Math.min(...items.map(p => p.y));
  return (Math.max(...items.map(p => p.x + p.w)) - left) * (Math.max(...items.map(p => p.y + p.h)) - top);
}
export function betterLayout(candidate, current) {
  return candidate.length > current.length || (candidate.length === current.length && envelope(candidate) < envelope(current) - 1e-6);
}
