const DOS_EPS_MAGIC = 0xc6d3d0c5;
const gsJavaScriptUrl = new URL('../node_modules/@bentopdf/gs-wasm/assets/gs.js', import.meta.url).href;
const gsWasmUrl = new URL('../node_modules/@bentopdf/gs-wasm/assets/gs.wasm', import.meta.url).href;

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

export async function convertEpsToPdf(input, onProgress = () => {}) {
  const postScript = extractPostScript(input);
  const output = [];
  onProgress('Loading offline EPS engine…');
  const { default: createGhostscript } = await import(/* @vite-ignore */ gsJavaScriptUrl);
  const gs = await createGhostscript({
    noExitRuntime: true,
    locateFile: path => path.endsWith('.wasm') ? gsWasmUrl : path,
    print: line => output.push(line),
    printErr: line => output.push(line),
  });

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
    return new Uint8Array(pdf);
  } catch (error) {
    const details = output.slice(-4).join(' ').replace(/\s+/g, ' ').trim();
    throw new Error(details ? `${error.message} ${details}` : error.message);
  } finally {
    for (const path of [inputPath, outputPath]) {
      try { gs.FS.unlink(path); } catch {}
    }
  }
}
