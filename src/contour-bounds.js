// Tight geometric bounds of the M/L/C/Z paths emitted by the PDF importer.
// Bezier handles are not points on the cut: only endpoints and derivative roots
// contribute to the finished-product rectangle. Stroke/bleed are excluded.
export function contourPathBounds(path) {
  const tokens = path?.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g);
  if (!tokens?.length) return null;
  let i = 0, current = null, start = null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const include = ([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  const point = () => [Number(tokens[i++]), Number(tokens[i++])];
  const at = (a, b, c, d, t) => (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d;
  const roots = (p0, p1, p2, p3) => {
    const a = -p0+3*p1-3*p2+p3, b = 2*(p0-2*p1+p2), c = p1-p0;
    if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c/b];
    const discriminant = b*b-4*a*c;
    if (discriminant < 0) return [];
    const r = Math.sqrt(discriminant);
    return [(-b+r)/(2*a), (-b-r)/(2*a)];
  };
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') { current = point(); start = current; include(current); }
    else if (command === 'L' && current) { current = point(); include(current); }
    else if (command === 'C' && current) {
      const a = current, b = point(), c = point(), d = point();
      if (![...b,...c,...d].every(Number.isFinite)) return null;
      include(d);
      for (const axis of [0, 1]) for (const t of roots(a[axis], b[axis], c[axis], d[axis])) {
        if (t > 0 && t < 1) include([at(a[0], b[0], c[0], d[0], t), at(a[1], b[1], c[1], d[1], t)]);
      }
      current = d;
    } else if (command === 'Z' && start) current = start;
    else return null;
    if (![...current, minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  }
  return maxX > minX && maxY > minY ? [minX, minY, maxX-minX, maxY-minY] : null;
}
