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

可拖放 `.md`、`.markdown` 或 `.pdf` 檔案到工作台。也可以按「開啟 Markdown」選取 Markdown，或按「PDF 轉 Markdown」選取 PDF。PDF 文字擷取在瀏覽器 Web Worker 及 Firecrawl PDF Inspector WebAssembly 中執行；轉換成功後，Markdown 會載入既有編輯器及預覽，可繼續檢查、修改、複製或下載。

掃描或混合型 PDF 可使用「辨識候選頁」或「辨識全部頁面」進行 OCR。辨識在瀏覽器本機逐頁執行，預設語言為繁體中文 + English；也可選擇繁體中文、English、简体中文 + English、日本語 + English 或 한국어 + English。可查看頁面進度並取消 OCR；結果會合併進 Markdown，已抽取的原始文字仍會保留。PDF 不會上傳到應用伺服器。

首次 OCR 需要網路下載所選 Tesseract.js 語言模型與 WebAssembly OCR 引擎；瀏覽器會快取模型供後續使用。PDF 頁面逐張渲染與辨識，完成後會釋放畫布以降低記憶體使用。解析器標記的 OCR 候選頁是啟發式提示，可能偏保守；模型載入期間取消時，當次語言模型下載可能仍會完成。

Markdown 檔案可直接在原始碼編輯器貼上或編輯。按「範例文件」可載入內建示例；「重新載入」會還原目前檔案或回到範例；「清除」會清空工作區。搜尋框可定位原始碼中的文字，右側面板可切換大綱、問題與文件元素。支援單欄原始碼/預覽模式與明暗主題。

Markdown 渲染結果經 DOMPurify 清理後再顯示。

## 來源

MD Inspector 的產品概念參考 Firecrawl 的 [PDF Inspector](https://github.com/firecrawl/pdf-inspector)，並使用其 MIT 授權的 [瀏覽器 WASM 套件](https://www.npmjs.com/package/@firecrawl/pdf-inspector-wasm)。授權和 Adobe CMaps 第三方聲明見 [NOTICE.md](./NOTICE.md)。
