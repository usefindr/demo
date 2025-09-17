declare module 'pdf2json' {
  type PdfTextRun = { T?: string };
  type PdfText = { R?: PdfTextRun[] };
  type PdfPage = { Texts?: PdfText[] };
  type PdfFormImage = { Pages?: PdfPage[] };

  export default class PDFParser {
    data?: { formImage?: PdfFormImage; Pages?: PdfPage[] };
    constructor(context?: unknown, parseImages?: number);
    on(event: 'pdfParser_dataError', handler: (errData: unknown) => void): void;
    on(event: 'pdfParser_dataReady', handler: (evtData: { formImage?: PdfFormImage; Pages?: PdfPage[] }) => void): void;
    loadPDF(path: string): void;
  }
}


