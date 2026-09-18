import { contourPathBounds } from './contour-bounds.js';

function strokeChroma(color) {
  if (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color)) return 0;
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  return Math.max(...channels) - Math.min(...channels);
}

// Dimension leaders and extension lines are open paths. A usable Cut Line must
// be made from closed paths, so exclude annotation geometry before ranking the
// remaining spot-colour groups.
export function selectCutContour(candidates, pageSize) {
  const closed = candidates
    .filter(candidate => candidate.closed && candidate.points?.length > 2 && candidate.d)
    .map(candidate => ({ ...candidate, box: contourPathBounds(candidate.d) }))
    .filter(candidate => candidate.box);
  if (!closed.length) return null;

  const groups = new Map();
  for (const candidate of closed) {
    const group = groups.get(candidate.stroke) || [];
    group.push(candidate);
    groups.set(candidate.stroke, group);
  }
  const selected = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || strokeChroma(b[0]) - strokeChroma(a[0]))[0][1];
  const points = selected.flatMap(candidate => candidate.points);
  const d = selected.map(candidate => candidate.d).join(' ');
  const box = contourPathBounds(d);
  return box ? { d, points, box, page: pageSize, selected } : null;
}
