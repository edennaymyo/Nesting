import { PDFDict, PDFName, PDFOperator, PDFOperatorNames, PDFString } from 'pdf-lib';

export const DEFAULT_GRAPHTEC_MARK_TYPE = 'type2';
export const DEFAULT_REGISTRATION_OUTPUT_MODE = 'marks';
const PT_PER_MM = 72 / 25.4;

export function registrationMarkLayerName(type = DEFAULT_GRAPHTEC_MARK_TYPE, stroke = 1, length = 5) {
  const typeNumber = type === 'type2' ? 2 : 1;
  return `reg_1 ${typeNumber} 0 25.00 ${Number(stroke).toFixed(2)} ${Number(length).toFixed(2)} 100.00 1 0 2 0 0.00`;
}

export function attachRegistrationMetadata(pdf, settings) {
  const [sheetW, sheetH] = settings.sheet;
  const encoded = encodeURIComponent([
    1, sheetW, sheetH, settings.box.x, settings.box.y, settings.box.w, settings.box.h,
    settings.mode, settings.markLayer, settings.type === 'type2' ? 2 : 1, settings.length, settings.thickness,
  ].join(','));
  const packet = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:nestcut="https://nestcut.app/ns/1.0/">
   <nestcut:registrationSettings>${encoded}</nestcut:registrationSettings>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const stream = pdf.context.stream(packet, { Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML') });
  pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(stream));
}

// Each corner is one closed, filled L polygon. The rectangle corner is the
// centerline intersection; the requested line thickness becomes real geometry.
export function registrationMarkPolygons(box, type = DEFAULT_GRAPHTEC_MARK_TYPE, length = 5, thickness = 1) {
  const inward = type === 'type2';
  const half = thickness / 2;
  const corners = [
    [box.x, box.y, inward ? 1 : -1, inward ? 1 : -1],
    [box.x + box.w, box.y, inward ? -1 : 1, inward ? 1 : -1],
    [box.x, box.y + box.h, inward ? 1 : -1, inward ? -1 : 1],
    [box.x + box.w, box.y + box.h, inward ? -1 : 1, inward ? -1 : 1],
  ];
  return corners.map(([x, y, dx, dy]) => [
    [x - dx * half, y - dy * half], [x + dx * length, y - dy * half],
    [x + dx * length, y + dy * half], [x + dx * half, y + dy * half],
    [x + dx * half, y + dy * length], [x - dx * half, y + dy * length],
  ]);
}

export function registrationMarksFitSheet(sheet, box, type = DEFAULT_GRAPHTEC_MARK_TYPE, length = 5, stroke = 1) {
  const values = [box.x, box.y, box.w, box.h, sheet.w, sheet.h, length, stroke];
  if (!values.every(Number.isFinite) || box.w <= 0 || box.h <= 0 || box.x < 0 || box.y < 0 || box.x + box.w > sheet.w || box.y + box.h > sheet.h) return false;
  if (length <= 0 || stroke <= 0) return false;
  const polygons = registrationMarkPolygons(box, type, length, stroke);
  return polygons.flat().every(([x, y]) => x >= 0 && y >= 0 && x <= sheet.w && y <= sheet.h);
}

export function createOptionalContentLayers(pdf, definitions) {
  const context = pdf.context;
  const layers = definitions.map(({ id, name }) => {
    const ref = context.register(context.obj({ Type: 'OCG', Name: PDFString.of(name) }));
    return { id, name, ref, resourceName: PDFName.of(`Layer_${id}`) };
  });
  const refs = context.obj(layers.map(layer => layer.ref));
  const defaultConfig = context.obj({
    Name: PDFString.of('NestCut layers'),
    BaseState: 'ON',
    ON: refs,
    Order: context.obj(layers.map(layer => layer.ref)),
  });
  pdf.catalog.set(PDFName.of('OCProperties'), context.obj({ OCGs: refs, D: defaultConfig }));
  return Object.fromEntries(layers.map(layer => [layer.id, layer]));
}

function installLayerResource(pdf, page, layer) {
  const context = pdf.context;
  let resources = page.node.Resources();
  if (!resources) {
    resources = context.obj({});
    page.node.set(PDFName.of('Resources'), resources);
  }
  let properties = resources.lookupMaybe(PDFName.of('Properties'), PDFDict);
  if (!properties) {
    properties = context.obj({});
    resources.set(PDFName.of('Properties'), properties);
  }
  properties.set(layer.resourceName, layer.ref);
}

function addLayerStream(pdf, page, layer, body) {
  installLayerResource(pdf, page, layer);
  const stream = pdf.context.stream(`q /OC /${layer.resourceName.asString().slice(1)} BDC\n${body}\nEMC Q`);
  page.node.addContentStream(pdf.context.register(stream));
}

export function wrapPageInOptionalLayer(pdf, page, layer) {
  installLayerResource(pdf, page, layer);
  page.node.normalize();
  const start = pdf.context.register(pdf.context.contentStream([
    PDFOperator.of(PDFOperatorNames.PushGraphicsState),
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), layer.resourceName]),
  ]));
  const end = pdf.context.register(pdf.context.contentStream([
    PDFOperator.of(PDFOperatorNames.EndMarkedContent),
    PDFOperator.of(PDFOperatorNames.PopGraphicsState),
  ]));
  if (!page.node.wrapContentStreams(start, end)) throw new Error('Unable to create the Illustrator print layer.');
}

export function drawRegistrationMarksInLayer(pdf, page, sheet, box, layer, { type = DEFAULT_GRAPHTEC_MARK_TYPE, length = 5, stroke = 1 } = {}) {
  if (!registrationMarksFitSheet(sheet, box, type, length, stroke)) throw new Error('Registration marks do not fit inside the paper. Move or resize the registration box.');
  const polygons = registrationMarkPolygons(box, type, length, stroke);
  const height = sheet.h * PT_PER_MM;
  const commands = ['0 0 0 rg'];
  for (const polygon of polygons) {
    polygon.forEach(([x, y], index) => commands.push(`${(x * PT_PER_MM).toFixed(4)} ${(height - y * PT_PER_MM).toFixed(4)} ${index ? 'l' : 'm'}`));
    commands.push('h f');
  }
  addLayerStream(pdf, page, layer, commands.join('\n'));
}

export function drawRegistrationBoxInLayer(pdf, page, sheet, box, layer) {
  if (![box.x, box.y, box.w, box.h].every(Number.isFinite) || box.w <= 0 || box.h <= 0 || box.x < 0 || box.y < 0 || box.x + box.w > sheet.w || box.y + box.h > sheet.h) throw new Error('Registration box must fit inside the paper. Move or resize the box.');
  const x = box.x * PT_PER_MM;
  const y = (sheet.h - box.y - box.h) * PT_PER_MM;
  const w = box.w * PT_PER_MM;
  const h = box.h * PT_PER_MM;
  addLayerStream(pdf, page, layer, `0.85 0.45 0 RG\n0.5 w\n${x.toFixed(4)} ${y.toFixed(4)} ${w.toFixed(4)} ${h.toFixed(4)} re S`);
}
