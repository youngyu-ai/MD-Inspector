# PDF Inspector 瀏覽器整合紀錄

Firecrawl 的 `@firecrawl/pdf-inspector-wasm` 使用與原生套件相同的 Rust 解析核心。瀏覽器 API 先呼叫 `init()`，再以 `Uint8Array` 傳入 `processPdf()`；結果包含 PDF 類型、頁數、處理時間、OCR 建議頁、信心值及可選的 Markdown。可指定 Markdown profile、頁碼標記及影像佔位內容。[1] [2]

官方文件說明，解析在本機執行、不會上傳 PDF，不要求 cross-origin isolation，但 `init()` 後解析是同步的；大型文件宜移至 Web Worker。純影像頁需要額外 OCR，因此此專案對無法抽取文字的掃描文件顯示明確提示，不假裝已產生有效 Markdown。[1]

此專案鎖定 `@firecrawl/pdf-inspector-wasm` 1.26.0。其套件授權為 MIT；套件附帶的 WASM binary 包含 Adobe CMaps 第三方聲明，授權文字已保存在 `NOTICE.md`。[3]

## References

[1]: https://github.com/firecrawl/pdf-inspector/blob/main/wasm/README.md "Firecrawl PDF Inspector WASM README"
[2]: https://github.com/firecrawl/pdf-inspector "Firecrawl PDF Inspector repository"
[3]: https://www.npmjs.com/package/@firecrawl/pdf-inspector-wasm "Firecrawl PDF Inspector WASM npm package"
