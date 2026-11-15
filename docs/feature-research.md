# MD Inspector 後續功能候選

本文件列出「建議評估」的下一階段功能，**不代表已實作**。目前完成項目是單檔 PDF 文字抽取、掃描頁 OCR 與 Markdown 工作台。

## 建議優先順序

| 優先度 | 功能 | 為什麼實用 | 估計成本 | 建議做法 |
| --- | --- | --- | --- | --- |
| 1 | 多檔批次轉換與 ZIP 匯出 | 研究論文、報告及掃描文件常成批處理；一次選取多份 PDF、逐檔顯示成功/失敗，最後打包 Markdown，可減少重複操作。 | 中 | 保持完全本機處理；每檔獨立錯誤隔離，提供取消與整批進度，下載 ZIP。 |
| 2 | 頁碼範圍／先轉前幾頁 | 長文件可以先抽查頁面與 OCR 品質，或只處理需要的部分，避免不必要的等待。 | 低–中 | 支援例如 `1-5, 12` 的頁碼範圍；預覽模式可先轉前三頁，之後再處理全文。 |
| 3 | 版面清理與表格重建 | PDF 常有跨行斷句、多欄混排、重複頁首頁尾與表格；清理能讓 Markdown 更適合直接閱讀與二次編輯。 | 中–高 | 以可切換選項提供「移除重複頁首頁尾」「修復斷詞」「表格重建」；保留原始抽取結果供比對，避免過度重寫。 |
| 4 | 圖片/圖表匯出與資產包 | 只輸出文字會遺失圖表資訊；抽取圖片並在 Markdown 內建立相對路徑，可保留視覺脈絡。 | 中 | 匯出 `.md` 加 `_assets/` 資料夾，連結圖片；在介面預覽抽取的圖片並提示來源頁碼。 |
| 5 | 加密 PDF 密碼對話框 | 使用者可以在本機處理受密碼保護的工作文件；避免把密碼寫入網址、紀錄或永久儲存。 | 中 | 記憶體內短暫使用密碼，完成或取消後丟棄；只在使用者明確輸入時嘗試解密。 |

## 依據與範圍

成熟的 PDF-to-Markdown 專案列出多檔批次處理、逐檔錯誤隔離、前三頁預覽、圖片輸出、頁首頁尾移除、斷詞修復、多欄文字與 Markdown 表格重建等能力；這些是候選方向，不是對目前 PDF Inspector WASM API 的承諾。[1]

本專案已採用 PDF.js 逐頁渲染、Tesseract.js 圖片 OCR。這個組合適合延伸頁碼選擇、OCR 預覽及逐頁圖片保留，但長文件仍應逐頁處理並釋放 Canvas，以控制記憶體。[2] [3] OCR 第一次使用需要下載所選模型；本機文件不會上傳，但「完全離線」並非首次使用時的現況。

## 來源

[1] [pdfmd — PDF to Markdown 開源工具](https://github.com/M1ck4/pdfmd)

[2] [PDF.js Browser Examples](https://mozilla.github.io/pdf.js/examples/)

[3] [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/frequently-asked-questions)

[4] [Tesseract.js Official README](https://github.com/naptha/tesseract.js)

[5] [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
