# 第三方來源與授權

MD Inspector 的產品概念參考 [Firecrawl PDF Inspector](https://github.com/firecrawl/pdf-inspector)，並使用 npm 套件 [`@firecrawl/pdf-inspector-wasm` 1.26.0](https://www.npmjs.com/package/@firecrawl/pdf-inspector-wasm)。本專案將該套件用於瀏覽器內的 PDF 分類與 Markdown 文字抽取。

## Firecrawl PDF Inspector WASM — MIT License

```text
MIT License

Copyright (c) 2026 Firecrawl

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Adobe CMaps notice included with the WebAssembly binary

The WASM binary embeds binary CMaps derived from Adobe CMap resources.

```text
Copyright 1990-2009 Adobe Systems Incorporated.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.

Neither the name of Adobe Systems Incorporated nor the names of its
contributors may be used to endorse or promote products derived from this
software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

## Tesseract.js、tesseract.js-core 與 PDF.js — Apache License 2.0

瀏覽器 OCR 使用 Tesseract.js 7.0.0；PDF 頁面渲染使用 Mozilla PDF.js 6.5.438。這些程式套件採用 Apache License 2.0；全文見 [`licenses/Apache-2.0.txt`](./licenses/Apache-2.0.txt)。

Tesseract.js: https://github.com/naptha/tesseract.js

tesseract.js-core: https://github.com/naptha/tesseract.js-core

PDF.js: https://github.com/mozilla/pdf.js

## Tesseract OCR 語言資料 — MIT License

瀏覽器會依使用者選取的語言，從 `@tesseract.js-data/<語言>` 套件的 CDN 資料路徑下載訓練資料。繁體中文與英文語言資料套件的 npm metadata 宣告為 MIT；來源 repository 為 https://github.com/naptha/tessdata 。訓練資料在執行時下載，本專案原始碼不隨附這些資料檔。
