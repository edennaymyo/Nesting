const PT_PER_MM = 72 / 25.4;
const CIRCLE_KAPPA = 0.5522847498307936;

function samplePath(shape, width, height) {
  const w = width * PT_PER_MM, h = height * PT_PER_MM;
  if (shape !== 'circle') return `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`;
  const rx = w / 2, ry = h / 2, kx = rx * CIRCLE_KAPPA, ky = ry * CIRCLE_KAPPA, cx = rx, cy = ry;
  return `M${cx} 0 C${cx + kx} 0 ${w} ${cy - ky} ${w} ${cy} C${w} ${cy + ky} ${cx + kx} ${h} ${cx} ${h} C${cx - kx} ${h} 0 ${cy + ky} 0 ${cy} C0 ${cy - ky} ${cx - kx} 0 ${cx} 0 Z`;
}

export function createSampleDesign({ shape = 'rectangle', width = 88.9, height = 50.8 } = {}) {
  if (!['rectangle', 'circle'].includes(shape)) throw new Error('Choose a rectangle or circle sample.');
  if (![width, height].every(value => Number.isFinite(value) && value >= 1 && value <= 3000)) throw new Error('Sample dimensions must be between 1 and 3000 mm.');
  const path = samplePath(shape, width, height), viewWidth = width * PT_PER_MM, viewHeight = height * PT_PER_MM;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}"><path d="${path}" fill="#56349b" stroke="#ef0783" stroke-width="3"/></svg>`;
  return {
    name: `Sample ${shape} · ${width} × ${height} mm`, w: width, h: height, color: '#56349b', cut: true, vector: true,
    box: [0, 0, viewWidth, viewHeight],
    contour: { box: [0, 0, viewWidth, viewHeight], mmBox: [0, 0, width, height], d: path, points: [] },
    preview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
}
