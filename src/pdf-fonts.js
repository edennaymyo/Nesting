import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';

const STANDARD_FONTS = new Set([
  'Courier','Courier-Bold','Courier-Oblique','Courier-BoldOblique',
  'Helvetica','Helvetica-Bold','Helvetica-Oblique','Helvetica-BoldOblique',
  'Times-Roman','Times-Bold','Times-Italic','Times-BoldItalic','Symbol','ZapfDingbats',
]);

const key = value => PDFName.of(value);
const fontName = value => String(value || '')
  .replace(/^\//, '')
  .replace(/^[A-Z]{6}\+/, '')
  .replace(/#20/g, ' ');

function lookup(context, value) {
  if (!value) return undefined;
  try { return context.lookup(value); } catch { return value; }
}

function descriptorFor(context, font) {
  const own = lookup(context, font.get(key('FontDescriptor')));
  if (own instanceof PDFDict) return own;
  const descendants = lookup(context, font.get(key('DescendantFonts')));
  if (!(descendants instanceof PDFArray) || descendants.size() === 0) return undefined;
  const descendant = lookup(context, descendants.get(0));
  return descendant instanceof PDFDict
    ? lookup(context, descendant.get(key('FontDescriptor')))
    : undefined;
}

/** Inspect whether live PDF fonts carry their font program inside the PDF. */
export async function inspectPdfFonts(input) {
  const pdf = await PDFDocument.load(input);
  const embedded = new Set();
  const referenced = new Set();
  const nonEmbedded = new Set();
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict) || String(object.get(key('Type'))) !== '/Font') continue;
    const name = fontName(object.get(key('BaseFont')));
    if (!name) continue;
    referenced.add(name);
    const subtype = String(object.get(key('Subtype')));
    const descriptor = descriptorFor(pdf.context, object);
    const hasProgram = subtype === '/Type3' || (descriptor instanceof PDFDict &&
      ['FontFile','FontFile2','FontFile3'].some(entry => descriptor.has(key(entry))));
    if (hasProgram) embedded.add(name);
    else if (!STANDARD_FONTS.has(name)) nonEmbedded.add(name);
  }
  return {
    embedded:[...embedded].sort(),
    referenced:[...referenced].sort(),
    nonEmbedded:[...nonEmbedded].sort(),
    missing:[],
    status:nonEmbedded.size?'warning':'safe',
  };
}
