import initPdfInspector, { processPdf, version, type PdfProcessResult } from '@firecrawl/pdf-inspector-wasm';
import wasmUrl from '@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm?url';
import type { PdfWorkerRequest, PdfWorkerResponse } from '../pdfTypes';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PdfWorkerRequest>) => void) | null;
  postMessage: (message: PdfWorkerResponse) => void;
};

let wasmReady: Promise<void> | null = null;

workerScope.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  try {
    workerScope.postMessage({ kind: 'status', phase: 'loading', message: '正在載入 PDF 解析器…' });
    wasmReady ??= initPdfInspector({ module_or_path: wasmUrl }).then(() => undefined);
    await wasmReady;

    workerScope.postMessage({ kind: 'status', phase: 'extracting', message: '正在分析頁面並轉換文字…' });
    const result: PdfProcessResult = processPdf(new Uint8Array(event.data.fileBuffer), {
      profile: 'fidelity',
      includePageMarkers: true,
      includeImages: true,
    });
    workerScope.postMessage({ kind: 'result', result, libraryVersion: version() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF 解析器無法讀取這份檔案。';
    workerScope.postMessage({ kind: 'error', message });
  }
};
