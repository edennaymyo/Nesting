const STANDARD_FONTS = new Set([
  'Courier','Courier-Bold','Courier-Oblique','Courier-BoldOblique',
  'Helvetica','Helvetica-Bold','Helvetica-Oblique','Helvetica-BoldOblique',
  'Times-Roman','Times-Bold','Times-Italic','Times-BoldItalic','Symbol','ZapfDingbats',
]);

const clean = value => value?.replace(/^\//,'').replace(/[),.;:'"]+$/,'');

export function inspectEpsFonts(input, ghostscriptLog = []) {
  const text = typeof input === 'string' ? input : new TextDecoder('windows-1252').decode(input);
  const embedded = new Set();
  const referenced = new Set();
  for (const match of text.matchAll(/\/FontName\s+\/([^\s/]+)\s+def/g)) embedded.add(clean(match[1]));
  for (const match of text.matchAll(/%%BeginResource:\s*font\s+([^\s]+)/gi)) embedded.add(clean(match[1]));
  for (const match of text.matchAll(/\/([^\s/]+)\s+findfont\b/g)) referenced.add(clean(match[1]));
  const log = Array.isArray(ghostscriptLog) ? ghostscriptLog.join('\n') : String(ghostscriptLog||'');
  const missing = new Set();
  for (const match of log.matchAll(/Substituting font\s+\S+\s+for\s+([^\s.]+)/gi)) missing.add(clean(match[1]));
  for (const match of log.matchAll(/(?:Can't find|cannot find) font\s+\/?([^\s.]+)/gi)) missing.add(clean(match[1]));
  for (const match of log.matchAll(/undefined in findfont[^\n]*?\/([^\s]+)/gi)) missing.add(clean(match[1]));
  const isEmbedded = name => embedded.has(name) || embedded.has(name.replace(/^[A-Z]{6}\+/,''));
  const ignored = name => !name || STANDARD_FONTS.has(name) || /^(?:AGM|Adobe|CIDInit|PDFMark|rootfont)/i.test(name);
  const nonEmbedded = [...referenced].filter(name=>!ignored(name)&&!isEmbedded(name));
  const missingFonts = [...missing].filter(name=>!ignored(name)&&!isEmbedded(name));
  return {
    embedded:[...embedded].sort(),
    referenced:[...referenced].sort(),
    nonEmbedded:nonEmbedded.sort(),
    missing:missingFonts.sort(),
    status:missingFonts.length?'missing':nonEmbedded.length?'warning':'safe',
  };
}
