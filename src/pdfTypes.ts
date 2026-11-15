import type { PdfProcessResult, PdfType } from '@firecrawl/pdf-inspector-wasm';

export interface PdfWorkerRequest {
  fileBuffer: ArrayBuffer;
}

export type PdfWorkerResponse =
  | { kind: 'status'; phase: 'loading' | 'extracting'; message: string }
  | { kind: 'result'; result: PdfProcessResult; libraryVersion: string }
  | { kind: 'error'; message: string };

export type PdfConversionPhase = 'loading' | 'extracting' | 'done' | 'partial' | 'needs-ocr' | 'error';

export interface PdfConversionState {
  phase: PdfConversionPhase;
  fileName: string;
  message: string;
  pdfType?: PdfType;
  pageCount?: number;
  processingTimeMs?: number;
  confidence?: number;
  pagesNeedingOcr?: number[];
  libraryVersion?: string;
}
