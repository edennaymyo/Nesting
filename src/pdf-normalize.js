import { PDFDocument } from 'pdf-lib';

export async function normalizePdfSelection(bytes, pageNumber, box) {
  const source=await PDFDocument.load(bytes),page=source.getPage(pageNumber-1),[left,bottom,right,top]=box;
  if (![left,bottom,right,top].every(Number.isFinite) || right<=left || top<=bottom) throw new Error('Selected EPS artboard has an invalid crop box.');
  const output=await PDFDocument.create(),embedded=await output.embedPage(page,{left,bottom,right,top}),normalized=output.addPage([right-left,top-bottom]);
  normalized.drawPage(embedded,{x:0,y:0,width:right-left,height:top-bottom});
  return output.save({useObjectStreams:false});
}
