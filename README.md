# MD Inspector

以 Bootstrap 製作的 Markdown 美化與檢查工作台。把 Gemini 產生的 Markdown 直接貼入，即可調整文章風格、字體、正文字級、標題比例、行距與段落間距，即時查看預覽並下載套用樣式的 HTML。另可清理多餘版面空白、重建不規則 Markdown／TSV 表格，並支援 PDF 轉 Markdown 與掃描 PDF 本機 OCR。

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

在原始碼編輯器貼上 Gemini Markdown、直接編輯，或拖放 `.md`、`.markdown` 檔案。中間預覽會即時更新。文章美化面板提供「雜誌編輯」「典雅長文」「清爽極簡」三種風格，以及黑體／襯線／系統字體選擇；可調整正文字級、標題大小、行距與段落間距。這些設定影響預覽與「下載美化 HTML」，不會改寫文章文字；仍可獨立下載或複製原始 Markdown。

「清理版面」整理重複空白行和行尾空白，保留程式碼圍欄內容；「重建表格」可將不規則的 pipe 表格或 tab 分隔表格整理成欄數一致、分隔列規範的 Markdown 表格。若沒有符合條件的表格或版面問題，工具會提示未執行修整。

也可按「PDF 轉 Markdown」選取 PDF。文字擷取在瀏覽器 Web Worker 及 Firecrawl PDF Inspector WebAssembly 中執行，轉換完成後可繼續編輯、檢查、複製或下載。掃描或混合型 PDF 可使用「辨識候選頁」或「辨識全部頁面」進行 OCR。OCR 在瀏覽器本機逐頁執行，預設語言為繁體中文 + English；亦可選擇繁體中文、English、简体中文 + English、日本語 + English 或 한국어 + English。可查看頁面進度並取消 OCR，辨識文字會合併進 Markdown，已抽取的原始文字仍會保留。

PDF 不會上傳到應用伺服器。首次 OCR 需要網路下載所選 Tesseract.js 語言模型與 WebAssembly OCR 引擎；瀏覽器會快取模型供後續使用。PDF 頁面逐張渲染與辨識，完成後會釋放畫布以降低記憶體使用。解析器標記的 OCR 候選頁是啟發式提示，辨識結果仍建議人工校對。

右側面板可切換大綱、問題與文件元素；另有文件統計、搜尋定位、單欄原始碼／預覽模式與明暗主題。Markdown 渲染結果經 DOMPurify 清理後再顯示。

## 來源

MD Inspector 的產品概念參考 Firecrawl 的 [PDF Inspector](https://github.com/firecrawl/pdf-inspector)，並使用其 MIT 授權的 [瀏覽器 WASM 套件](https://www.npmjs.com/package/@firecrawl/pdf-inspector-wasm)。授權和 Adobe CMaps 第三方聲明見 [NOTICE.md](./NOTICE.md)。
