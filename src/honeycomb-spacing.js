import { contourRings, placedShape, placementWithinSheet, shapesConflict } from './contour-geometry.js';

// The raster pass is a fast row-spacing estimate, not the final cut-gap test.
// Correct complete rows together; never drop alternate colliding copies/rows.
export function refineHoneycombRows(items, art, sheet, gap) {
  const rings = contourRings(art);
  if (!rings || !items.length) return items;
  const rows = [];
  for (const item of items) {
    const last = rows.at(-1);
    if (!last || Math.abs(last[0].y-item.y) > 1e-7) rows.push([item]);
    else last.push(item);
  }
  const result = [], shapes = [];
  let shift = 0;
  for (const row of rows) {
    const fits = y => {
      const candidate = row.map(item => ({ ...item, y }));
      const current = candidate.map(item => placedShape(rings, item));
      if (candidate.some((item,i) => !placementWithinSheet(item,current[i],sheet))) return null;
      if (current.some((shape,i) => shapes.some(other => shapesConflict(shape,other,gap)) || current.slice(0,i).some(other => shapesConflict(shape,other,gap)))) return null;
      return { candidate, current };
    };
    let y = row[0].y+shift, accepted = fits(y);
    // Usually only a fraction of a millimetre is needed to correct raster erosion.
    while (!accepted && y+row[0].h <= sheet.h) {
      const low = y;
      y = Math.min(y+0.25, sheet.h-row[0].h);
      if (y <= low) break;
      accepted = fits(y);
      if (accepted) {
        let left = low, right = y;
        for (let n=0;n<8;n++) {
          const middle=(left+right)/2, refined=fits(middle);
          if (refined) { right=middle; accepted=refined; } else left=middle;
        }
        y=right;
      }
    }
    if (!accepted) break;
    shift=y-row[0].y;
    result.push(...accepted.candidate);shapes.push(...accepted.current);
  }
  return result.map((item,i)=>({...item,i}));
}
