import { rgb } from 'pdf-lib';

// All geometry is in millimetres from the full sheet's top-left, not artwork bounds.
export function boxFromInsets(sheet, insets) {
  return { x: insets.left, y: insets.top, w: sheet.w - insets.left - insets.right, h: sheet.h - insets.top - insets.bottom };
}
export function insetsFromBox(sheet, box) {
  return { left: box.x, top: box.y, right: sheet.w - box.x - box.w, bottom: sheet.h - box.y - box.h };
}
export function reflectBox(sheet, box) {
  return { ...box, x: sheet.w - box.x - box.w };
}
export function validBox(sheet, box) {
  return Object.values(box).every(Number.isFinite) && box.w >= 1 && box.h >= 1 && box.x >= -1e-8 && box.y >= -1e-8 && box.x + box.w <= sheet.w + 1e-8 && box.y + box.h <= sheet.h + 1e-8;
}
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function moveBox(sheet, box, handle, dx, dy) {
  if (handle === 'move') return { ...box, x: clamp(box.x + dx, 0, sheet.w - box.w), y: clamp(box.y + dy, 0, sheet.h - box.h) };
  let l = box.x, r = box.x + box.w, t = box.y, b = box.y + box.h;
  if (handle.includes('w')) l = clamp(l + dx, 0, r - 1);
  if (handle.includes('e')) r = clamp(r + dx, l + 1, sheet.w);
  if (handle.includes('n')) t = clamp(t + dy, 0, b - 1);
  if (handle.includes('s')) b = clamp(b + dy, t + 1, sheet.h);
  return { x: l, y: t, w: r - l, h: b - t };
}
export function drawRegistrationBox(page, sheet, box) {
  if (!validBox(sheet, box)) throw new Error('Registration box must fit inside the paper. Reset or adjust the box.');
  const pt = 72 / 25.4;
  // A single closed, unfilled vector path, deliberately NOT a CutContour spot color.
  page.drawRectangle({ x: box.x * pt, y: (sheet.h - box.y - box.h) * pt, width: box.w * pt, height: box.h * pt, borderWidth: 0.5, borderColor: rgb(0.85, 0.45, 0), color: undefined });
}
