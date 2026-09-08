export const DEFAULT_MARGINS_MM = Object.freeze({
  top: 22.86,
  right: 12.7,
  bottom: 12.7,
  left: 12.7,
});

export const DEFAULT_GAP_MM = 5.08;

// Center the complete cut-bound envelope without changing the packing itself.
// Items are expressed in the usable area's coordinate system.
export function centerLayout(items, usable) {
  if (!items.length) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.w);
    maxY = Math.max(maxY, item.y + item.h);
  }
  const dx = (usable.w - (maxX - minX)) / 2 - minX;
  const dy = (usable.h - (maxY - minY)) / 2 - minY;
  return items.map(item => ({ ...item, x: item.x + dx, y: item.y + dy }));
}
