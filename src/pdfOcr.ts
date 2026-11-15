import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

export type OcrLanguage = 'chi_tra+eng' | 'chi_tra' | 'eng' | 'chi_sim+eng' | 'jpn+eng' | 'kor+eng';
export type OcrStage = 'loading' | 'rendering' | 'recognizing';

export interface OcrProgress {
  stage: OcrStage;
  progress: number;
  currentPage: number;
  totalPages: number;
  message: string;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OcrResult {
  totalPages: number;
  pages: OcrPageResult[];
  failedPages: number[];
}

export const OCR_LANGUAGE_LABELS: Record<OcrLanguage, string> = {
  'chi_tra+eng': '繁體中文 + English',
  chi_tra: '繁體中文',
  eng: 'English',
  'chi_sim+eng': '简体中文 + English',
  'jpn+eng': '日本語 + English',
  'kor+eng': '한국어 + English',
};

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function createAbortError(): DOMException {
  return new DOMException('OCR 已取消。', 'AbortError');
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw createAbortError();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function waitForAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(createAbortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

function describeTesseractStage(status: string, currentPage: number, language: OcrLanguage): string {
  if (status === 'loading tesseract core') return '正在載入 OCR 引擎…';
  if (status === 'loading language traineddata') return `正在下載 ${OCR_LANGUAGE_LABELS[language]} 語言模型（首次使用需要下載）…`;
  if (status === 'initializing tesseract') return '正在初始化 OCR 語言模型…';
  if (status === 'initializing api') return '正在準備文字辨識…';
  if (status === 'recognizing text') return `正在辨識第 ${currentPage} 頁…`;
  return '正在準備 OCR…';
}

export async function recognizePdfPages(
  file: File,
  language: OcrLanguage,
  requestedPages: number[] | null,
  signal: AbortSignal,
  onProgress: (progress: OcrProgress) => void,
): Promise<OcrResult> {
  throwIfAborted(signal);

  const fileData = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);

  const loadingTask = getDocument({ data: fileData });
  let activeRenderTask: { cancel: () => void } | null = null;
  let tesseractWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let activePage = 1;

  const onAbort = () => {
    try {
      activeRenderTask?.cancel();
    } catch {
      // A completed PDF.js render task cannot be cancelled retroactively.
    }
    if (tesseractWorker) void tesseractWorker.terminate();
    void loadingTask.destroy();
  };
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    onProgress({ stage: 'loading', progress: 0, currentPage: 1, totalPages: 0, message: '正在讀取 PDF 頁面…' });
    const pdf = await waitForAbortable(loadingTask.promise, signal);
    throwIfAborted(signal);

    const validPages = [...new Set((requestedPages ?? Array.from({ length: pdf.numPages }, (_, index) => index + 1))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= pdf.numPages))]
      .sort((left, right) => left - right);
    const pageCount = validPages.length;
    if (!pageCount) throw new Error('沒有可供 OCR 的有效頁面。');

    const workerPromise = createWorker(language, 1, {
      workerPath: tesseractWorkerUrl,
      workerBlobURL: false,
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0',
      logger: (entry) => {
        const progress = clamp(entry.progress ?? 0);
        const modelProgress = progress * 0.05;
        onProgress({
          stage: 'loading',
          progress: modelProgress,
          currentPage: activePage,
          totalPages: pageCount,
          message: describeTesseractStage(entry.status, activePage, language),
        });
      },
    });
    void workerPromise.then((worker) => {
      if (signal.aborted) void worker.terminate();
    }).catch(() => undefined);
    tesseractWorker = await waitForAbortable(workerPromise, signal);
    throwIfAborted(signal);

    const results: OcrPageResult[] = [];
    const failedPages: number[] = [];
    const maxCanvasPixels = 6_000_000;

    for (const [index, pageNumber] of validPages.entries()) {
      throwIfAborted(signal);
      activePage = pageNumber;
      let page: Awaited<ReturnType<typeof pdf.getPage>> | null = null;
      let canvas: HTMLCanvasElement | null = null;

      try {
        page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const area = baseViewport.width * baseViewport.height;
        const scale = Math.min(2, Math.sqrt(maxCanvasPixels / Math.max(area, 1)));
        const viewport = page.getViewport({ scale });
        canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('瀏覽器無法建立 PDF 頁面畫布。');

        onProgress({
          stage: 'rendering',
          progress: 0.05 + (index / pageCount) * 0.95,
          currentPage: pageNumber,
          totalPages: pageCount,
          message: `正在繪製第 ${pageNumber} 頁供 OCR 辨識…`,
        });
        const renderTask = page.render({ canvas, canvasContext: context, viewport });
        activeRenderTask = renderTask;
        await renderTask.promise;
        activeRenderTask = null;
        throwIfAborted(signal);

        const result = await tesseractWorker.recognize(canvas, {}, {
          blocks: false,
          hocr: false,
          tsv: false,
          text: true,
        });
        const text = result.data.text.trim();
        if (text) {
          results.push({ pageNumber, text, confidence: result.data.confidence });
        }
      } catch (error) {
        if (signal.aborted) throw createAbortError();
        failedPages.push(pageNumber);
        console.warn(`PDF OCR failed on page ${pageNumber}`, error);
      } finally {
        activeRenderTask = null;
        page?.cleanup();
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
          canvas.remove();
        }
      }
    }

    return { totalPages: pdf.numPages, pages: results, failedPages };
  } finally {
    signal.removeEventListener('abort', onAbort);
    try {
      if (tesseractWorker) await tesseractWorker.terminate();
    } catch {
      // The worker may already have been terminated by the cancel action.
    }
    try {
      await loadingTask.destroy();
    } catch {
      // PDF.js may already have been destroyed by the cancel action.
    }
  }
}

function normalizeForComparison(text: string): string {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function isLikelyDuplicate(nativeText: string, ocrText: string): boolean {
  const native = normalizeForComparison(nativeText);
  const recognized = normalizeForComparison(ocrText);
  if (native.length < 24 || recognized.length < 24) return false;
  const nativeSample = native.slice(0, Math.min(48, native.length));
  const ocrSample = recognized.slice(0, Math.min(48, recognized.length));
  return native.includes(ocrSample) || recognized.includes(nativeSample);
}

export function mergeOcrMarkdown(markdown: string, pages: OcrPageResult[]): string {
  const additions = new Map(pages.filter((page) => page.text.trim()).map((page) => [page.pageNumber, page.text.trim()]));
  if (!additions.size) return markdown;

  const pageMarker = /<!--\s*Page\s+(\d+)\s*-->/gi;
  const markers = [...markdown.matchAll(pageMarker)];
  if (!markers.length) {
    const newSections = [...additions.entries()]
      .sort(([left], [right]) => left - right)
      .map(([pageNumber, text]) => `<!-- Page ${pageNumber} -->\n\n<!-- OCR text -->\n${text}`);
    return [markdown.trim(), ...newSections].filter(Boolean).join('\n\n');
  }

  let output = '';
  let cursor = 0;
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const markerIndex = marker.index ?? 0;
    const pageNumber = Number(marker[1]);
    const bodyStart = markerIndex + marker[0].length;
    const bodyEnd = markers[index + 1]?.index ?? markdown.length;
    let body = markdown.slice(bodyStart, bodyEnd);
    const recognized = additions.get(pageNumber);
    if (recognized && !isLikelyDuplicate(body, recognized)) {
      const supplement = `<!-- OCR text -->\n\n${recognized}`;
      body = body.trim() ? `${body.trim()}\n\n${supplement}` : `\n\n${supplement}`;
      additions.delete(pageNumber);
    } else if (recognized) {
      additions.delete(pageNumber);
    }
    output += markdown.slice(cursor, markerIndex) + marker[0] + body;
    cursor = bodyEnd;
  }
  output += markdown.slice(cursor);

  if (additions.size) {
    const newSections = [...additions.entries()]
      .sort(([left], [right]) => left - right)
      .map(([pageNumber, text]) => `<!-- Page ${pageNumber} -->\n\n<!-- OCR text -->\n${text}`);
    output = [output.trim(), ...newSections].filter(Boolean).join('\n\n');
  }
  return output.trim();
}
