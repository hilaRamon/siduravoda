import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * @param {HTMLElement | null} element
 * @param {string} filename
 * @param {{ orientation?: 'portrait' | 'landscape' }} [options]
 */
export async function exportReportElementPdf(element, filename, { orientation = 'portrait' } = {}) {
  if (!element) return;

  /** @type {import('jspdf').jsPDFOptions} */
  const pdfOptions = { orientation, unit: 'mm', format: 'a4' };
  const pdf = new jsPDF(pdfOptions);
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  const SCALE = 1.5;
  const canvas = await html2canvas(element, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const pxPerMM = canvas.width / contentW;
  const pageHeightPx = contentH * pxPerMM;

  let srcY = 0;
  let firstPage = true;
  while (srcY < canvas.height) {
    const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    const context = slice.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is unavailable');
    }
    context.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!firstPage) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', margin, margin, contentW, sliceH / pxPerMM);
    srcY += sliceH;
    firstPage = false;
  }

  pdf.save(filename);
}
