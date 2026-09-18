const DOS_EPS_MAGIC = 0xc6d3d0c5;
const gsJavaScriptUrl = new URL('../node_modules/@bentopdf/gs-wasm/assets/gs.js', import.meta.url).href;
const gsWasmUrl = new URL('../node_modules/@bentopdf/gs-wasm/assets/gs.wasm', import.meta.url).href;
import { inspectEpsFonts } from './eps-fonts.js';
import { removeHiddenEpsArtboardClips } from './pdf-prune.js';

let ghostscriptPromise;
let ghostscriptOutput;

async function getGhostscript(output) {
  ghostscriptOutput = output;
  if (!ghostscriptPromise) {
    ghostscriptPromise = import(/* @vite-ignore */ gsJavaScriptUrl).then(({ default: createGhostscript }) => createGhostscript({
      noExitRuntime: true,
      locateFile: path => path.endsWith('.wasm') ? gsWasmUrl : path,
      print: line => ghostscriptOutput?.push(line),
      printErr: line => ghostscriptOutput?.push(line),
    })).catch(error => {
      ghostscriptPromise = undefined;
      throw error;
    });
  }
  return ghostscriptPromise;
}

export function epsArtboardArguments(inputPath, outputPath, crop) {
  const [left, bottom, right, top] = crop;
  if (![left, bottom, right, top].every(Number.isFinite) || right <= left || top <= bottom) {
    throw new Error('Selected EPS artboard has an invalid crop box.');
  }
  return [
    '-dSAFER', '-dBATCH', '-dNOPAUSE',
    '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.7',
    '-dAutoRotatePages=/None',
    '-dColorConversionStrategy=/LeaveColorUnchanged',
    '-dPreserveSeparation=true', '-dFIXEDMEDIA',
    `-dDEVICEWIDTHPOINTS=${right-left}`,
    `-dDEVICEHEIGHTPOINTS=${top-bottom}`,
    `-sOutputFile=${outputPath}`,
    '-c', `<</PageOffset [${-left} ${-bottom}]>> setpagedevice`,
    '-f', inputPath,
  ];
}

function uint32LE(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

export function extractPostScript(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength >= 12 && uint32LE(bytes, 0) === DOS_EPS_MAGIC) {
    const start = uint32LE(bytes, 4);
    const length = uint32LE(bytes, 8);
    if (start < 30 || length === 0 || start + length > bytes.byteLength) {
      throw new Error('The DOS EPS preview header is damaged. Re-save the EPS from Illustrator.');
    }
    return bytes.slice(start, start + length);
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x21) return bytes.slice();
  throw new Error('This file is not a valid EPS/PostScript document.');
}

export async function convertEpsToPdf(input, onProgress = () => {}, onPreflight = () => {}) {
  const postScript = extractPostScript(input);
  const output = [];
  onProgress('Loading offline EPS engine…');
  const gs = await getGhostscript(output);

  const inputPath = `/nestcut-${crypto.randomUUID()}.eps`;
  const outputPath = `/nestcut-${crypto.randomUUID()}.pdf`;
  try {
    gs.FS.writeFile(inputPath, postScript);
    onProgress('Converting EPS artwork to vector PDF…');
    const status = gs.callMain([
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dEPSCrop',
      '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.7',
      '-dAutoRotatePages=/None',
      '-dColorConversionStrategy=/LeaveColorUnchanged',
      '-dPreserveSeparation=true',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]);
    if (status !== 0) throw new Error(`Ghostscript stopped with code ${status}.`);
    const pdf = gs.FS.readFile(outputPath);
    if (pdf.byteLength < 5 || new TextDecoder('ascii').decode(pdf.slice(0, 5)) !== '%PDF-') {
      throw new Error('EPS conversion did not produce a valid PDF.');
    }
    onPreflight(inspectEpsFonts(postScript, output));
    return new Uint8Array(pdf);
  } catch (error) {
    const details = output.slice(-4).join(' ').replace(/\s+/g, ' ').trim();
    throw new Error(details ? `${error.message} ${details}` : error.message);
  } finally {
    ghostscriptOutput = undefined;
    for (const path of [inputPath, outputPath]) {
      try { gs.FS.unlink(path); } catch {}
    }
  }
}

// Illustrator EPS flattens all artboards into one PostScript page. Embedding a
// cropped PDF page only hides the other artboards inside a clipping form, which
// makes them reappear when Illustrator opens the export. Rendering the original
// EPS into a fixed media page lets Ghostscript discard operators outside the
// selected artboard while preserving the selected artwork as vectors.
export async function convertEpsArtboardToPdf(input, crop, onProgress = () => {}) {
  const postScript = extractPostScript(input), output = [];
  onProgress('Isolating selected EPS artboard…');
  const gs = await getGhostscript(output);
  const inputPath = `/nestcut-${crypto.randomUUID()}.eps`;
  const outputPath = `/nestcut-${crypto.randomUUID()}.pdf`;
  try {
    gs.FS.writeFile(inputPath, postScript);
    const status = gs.callMain(epsArtboardArguments(inputPath, outputPath, crop));
    if (status !== 0) throw new Error(`Ghostscript stopped with code ${status}.`);
    const pdf = gs.FS.readFile(outputPath);
    if (pdf.byteLength < 5 || new TextDecoder('ascii').decode(pdf.slice(0, 5)) !== '%PDF-') {
      throw new Error('EPS artboard isolation did not produce a valid PDF.');
    }
    return new Uint8Array(await removeHiddenEpsArtboardClips(pdf));
  } catch (error) {
    const details = output.slice(-4).join(' ').replace(/\s+/g, ' ').trim();
    throw new Error(details ? `${error.message} ${details}` : error.message);
  } finally {
    ghostscriptOutput = undefined;
    for (const path of [inputPath, outputPath]) {
      try { gs.FS.unlink(path); } catch {}
    }
  }
}
