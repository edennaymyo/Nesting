import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

const paintOperator = /^(?:S|s|f|F|f\*|B|B\*|b|b\*|Do|sh|BT|BI)$/;

// Ghostscript correctly removes paint outside fixed media, but can retain the
// discarded artboard's clipping path as an empty q…Q group. Illustrator exposes
// that harmless-but-confusing path when opening the PDF. Remove only groups that
// establish clipping and contain no paint, text, image, or shading operation.
export function pruneClipOnlyGroups(source) {
  const lines = source.split(/\r?\n/), stack = [], intervals = [];
  for (let index=0; index<lines.length; index++) {
    const operator = lines[index].trim();
    if (operator === 'q') stack.push(index);
    else if (operator === 'Q' && stack.length) {
      const start = stack.pop(), block = lines.slice(start, index+1), text = block.join('\n');
      const clips = /(?:^|\s)W\*?\s+n(?:\s|$)/m.test(text);
      const paints = block.some(line => paintOperator.test(line.trim()));
      if (clips && !paints) intervals.push([start,index]);
    }
  }
  if (!intervals.length) return source;
  const outermost = intervals.filter(([start,end]) => !intervals.some(([otherStart,otherEnd]) => otherStart<start && otherEnd>end));
  return lines.filter((_,index) => !outermost.some(([start,end]) => index>=start && index<=end)).join('\n');
}

export async function removeHiddenEpsArtboardClips(bytes) {
  const pdf = await PDFDocument.load(bytes), decoder = new TextDecoder('latin1'), encoder = new TextEncoder();
  for (const [ref, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    let decoded;
    try { decoded = decodePDFRawStream(object).decode(); } catch { continue; }
    const source = decoder.decode(decoded);
    if (!/(?:^|\s)W\*?\s+n(?:\s|$)/m.test(source)) continue;
    const pruned = pruneClipOnlyGroups(source);
    if (pruned === source) continue;
    const replacement = pdf.context.flateStream(encoder.encode(pruned));
    for (const [key,value] of object.dict.entries()) {
      if (![PDFName.of('Length'),PDFName.of('Filter'),PDFName.of('DecodeParms')].some(name=>name===key)) replacement.dict.set(key,value);
    }
    pdf.context.assign(ref,replacement);
  }
  return pdf.save({useObjectStreams:false});
}
