import { rgb } from 'pdf-lib';

export const LAMINATION_OPTIONS = Object.freeze(['None', 'Gloss Laminate', 'Matte Laminate']);

export function extractSNumber(sourceName = '') {
  return sourceName.match(/(?:^|[^a-z0-9])(s\d{4,})(?=$|[^a-z0-9])/i)?.[1].toUpperCase() || '';
}

export function cleanJobPart(value) {
  return String(value || '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
}

export function buildExportBaseName({ sourceName, media, lamination = 'None', goldFoil = false, sheets = 1 }) {
  const jobNumber = extractSNumber(sourceName);
  const safeMedia = cleanJobPart(media) || 'Media';
  const safeLamination = LAMINATION_OPTIONS.includes(lamination) ? lamination : 'None';
  const count = Math.max(1, Math.floor(Number(sheets) || 1));
  const finishes = jobNumber ? [safeLamination === 'None' ? '' : safeLamination, goldFoil ? 'Gold Foil' : ''] : [];
  return [jobNumber, safeMedia, ...finishes, `${count} ${count === 1 ? 'sheet' : 'sheets'}`]
    .filter(Boolean)
    .join('-');
}

export function buildExportFileName(settings) {
  const customName = cleanJobPart(settings.customName);
  if (customName) return /\.pdf$/i.test(customName) ? customName : `${customName}.pdf`;
  return `${buildExportBaseName(settings)}.pdf`;
}

export function drawExportFileName(page, sheet, fileName, font, includeLabel = true) {
  if (!includeLabel) return;
  const pt = 72 / 25.4;
  const size = 7;
  const top = 5 * pt;
  page.drawText(cleanJobPart(fileName), {
    x: 5 * pt,
    y: sheet.h * pt - top - font.heightAtSize(size),
    size,
    font,
    color: rgb(0, 0, 0),
  });
}
