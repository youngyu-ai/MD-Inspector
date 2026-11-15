# MD Inspector

以 Bootstrap 製作的 Markdown 檢查工作台。支援本機 `.md` 檔案、拖放與貼上內容，提供原始碼/渲染預覽、文件統計、大綱跳轉、結構檢查，以及連結、圖片、程式碼、表格和引用清單。

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

可拖放 `.md` 或 `.markdown` 檔案到工作台，或按「開啟 Markdown」選取本機檔案。也可以直接在原始碼編輯器貼上或編輯 Markdown。按「範例文件」可載入內建示例；「重新載入」會還原目前檔案或回到範例；「清除」會清空工作區。搜尋框可定位原始碼中的文字，右側面板可切換大綱、問題與文件元素。支援單欄原始碼/預覽模式與明暗主題。

文件內容在瀏覽器端解析與檢查，不會被上傳到應用程式伺服器。渲染結果經 DOMPurify 清理後再顯示。

## 來源

產品概念參考 Firecrawl 的 [PDF Inspector](https://github.com/firecrawl/pdf-inspector)，MIT 授權與來源說明見 [NOTICE.md](./NOTICE.md)。MD Inspector 聚焦於 Markdown 檢視與品質檢查，並非 PDF 解析器。
