# MD Inspector

以 Bootstrap 製作的 Markdown 檢查工作台。支援本機 `.md` 檔案、拖放與貼上內容，並可把文字型 PDF 轉為 Markdown。提供原始碼/渲染預覽、文件統計、大綱跳轉、結構檢查，以及連結、圖片、程式碼、表格和引用清單。

## 本機啟動

需求：Node.js 20+ 與 pnpm 11+。

```sh
pnpm install
pnpm dev
```

接著在瀏覽器開啟 `http://localhost:3000`。建立可發布版本：

```sh
pnpm build
pnpm preview
```

## 使用方式

可拖放 `.md`、`.markdown` 或 `.pdf` 檔案到工作台。也可以按「開啟 Markdown」選取 Markdown，或按「PDF 轉 Markdown」選取 PDF。PDF 文字擷取在瀏覽器 Web Worker 及 Firecrawl PDF Inspector WebAssembly 中執行，PDF 檔案不會上傳到應用程式伺服器；轉換成功後，Markdown 會載入既有編輯器及預覽，可繼續檢查、修改、複製或下載。大型 PDF 解析期間會顯示狀態，且不會阻塞主要介面。

瀏覽器版 PDF parser 抽取 PDF 內嵌文字，不執行 OCR。若 PDF 是掃描影像或某些頁面沒有文字層，工作台會提醒可能需要 OCR；解析器對候選頁面的判定可能偏保守。混合型文件仍會載入可抽取的文字，並提示待 OCR 頁面。

Markdown 檔案可直接在原始碼編輯器貼上或編輯。按「範例文件」可載入內建示例；「重新載入」會還原目前檔案或回到範例；「清除」會清空工作區。搜尋框可定位原始碼中的文字，右側面板可切換大綱、問題與文件元素。支援單欄原始碼/預覽模式與明暗主題。

Markdown 渲染結果經 DOMPurify 清理後再顯示。

## 來源

MD Inspector 的產品概念參考 Firecrawl 的 [PDF Inspector](https://github.com/firecrawl/pdf-inspector)，並使用其 MIT 授權的 [瀏覽器 WASM 套件](https://www.npmjs.com/package/@firecrawl/pdf-inspector-wasm)。授權和 Adobe CMaps 第三方聲明見 [NOTICE.md](./NOTICE.md)。
