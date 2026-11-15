import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { analyzeMarkdown, getLineStart, type DocumentElement, type IssueCategory, type MarkdownIssue } from './analysis';

type Theme = 'light' | 'dark';
type ViewMode = 'split' | 'source' | 'preview';
type InspectorTab = 'outline' | 'issues' | 'elements';
type IssueFilter = 'all' | IssueCategory;

const SAMPLE_MARKDOWN = `# Markdown 品質檢查

這份範例展示 MD Inspector 的工作流程。上方查看統計，右側面板可以切換**文件大綱**、品質問題與可檢視的文件元素。

## 結構清楚，閱讀更容易

用標題建立明確的層次。讀者可先掃描大綱，再跳到需要的章節。

### 一段完整的說明

Markdown 適合用在技術說明、研究筆記與專案文件。你可以直接貼上內容，或拖放自己的 [本機檔案](https://example.com/guide) 開始檢查。

## 文件元素一覽

| 元素 | 用途 | 檢查重點 |
| --- | --- | --- |
| 連結 | 導向更多資料 | 文字與網址都要明確 |
| 圖片 | 補充視覺資訊 | 加上替代文字 |
| 程式碼 | 分享可執行範例 | 指定程式語言 |

> 好的文件，讓重要資訊更容易被找到。

### 簡單的程式碼

\`\`\`python
def greet(name: str) -> str:
    return f"Hello, {name}!"
\`\`\`

**開始試用：**編輯左側文字，右側預覽會即時更新。選取右側任一標題或問題項目，可快速定位到原始碼。`;

const issueLabels: Record<IssueCategory, string> = {
  structure: '結構',
  links: '連結與圖片',
  syntax: '語法',
};

const elementLabels: Record<DocumentElement['type'], string> = {
  link: '連結',
  image: '圖片',
  code: '程式碼',
  table: '表格',
  quote: '引用',
};

function countWords(text: string): number {
  if (!text.trim()) return 0;
  try {
    const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
    return [...segmenter.segment(text)].filter((part) => part.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

function readingMinutes(text: string): number {
  const cjk = (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? []).length;
  const latin = (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).filter((word) => !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(word)).length;
  const minutes = cjk / 420 + latin / 220;
  return text.trim() ? Math.max(1, Math.ceil(minutes)) : 0;
}

function formatBytes(byteCount: number): string {
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(byteCount < 10 * 1024 ? 1 : 0)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-Hant').format(value);
}

function makeSearchCount(source: string, query: string): number {
  if (!query) return 0;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...source.matchAll(new RegExp(escaped, 'gi'))].length;
}

function highlightTextNodes(root: HTMLElement, query: string): void {
  if (!query) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!node.textContent?.trim() || parent?.closest('mark, script, style')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const lowerQuery = query.toLocaleLowerCase();
  nodes.forEach((node) => {
    const original = node.textContent ?? '';
    const lower = original.toLocaleLowerCase();
    let cursor = 0;
    let found = lower.indexOf(lowerQuery, cursor);
    if (found < 0) return;
    const fragment = document.createDocumentFragment();
    while (found >= 0) {
      if (found > cursor) fragment.append(document.createTextNode(original.slice(cursor, found)));
      const mark = document.createElement('mark');
      mark.className = 'search-hit';
      mark.textContent = original.slice(found, found + query.length);
      fragment.append(mark);
      cursor = found + query.length;
      found = lower.indexOf(lowerQuery, cursor);
    }
    if (cursor < original.length) fragment.append(document.createTextNode(original.slice(cursor)));
    node.parentNode?.replaceChild(fragment, node);
  });
}

function getIssueIcon(issue: MarkdownIssue): string {
  if (issue.category === 'structure') return 'bi-diagram-3';
  if (issue.category === 'links') return 'bi-link-45deg';
  return 'bi-braces-asterisk';
}

function App() {
  const [content, setContent] = useState(SAMPLE_MARKDOWN);
  const [fileName, setFileName] = useState('quick-start.md');
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('md-inspector-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [activeTab, setActiveTab] = useState<InspectorTab>('outline');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCursor, setSearchCursor] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analysis = useMemo(() => analyzeMarkdown(content), [content]);
  const searchCount = useMemo(() => makeSearchCount(content, searchQuery), [content, searchQuery]);
  const issueCount = analysis.issues.length;
  const errorCount = analysis.issues.filter((issue) => issue.severity === 'error').length;
  const wordCount = countWords(content);
  const characterCount = [...content].length;
  const lineCount = content ? content.split(/\r\n|\r|\n/).length : 0;
  const readingTime = readingMinutes(content.replace(/[#>*_`|\[\]()!-]/g, ' '));
  const fileBytes = new Blob([content]).size;
  const renderedHtml = useMemo(() => {
    const unsafeHtml = marked.parse(content, { gfm: true, breaks: false, async: false }) as string;
    return DOMPurify.sanitize(unsafeHtml, { USE_PROFILES: { html: true } });
  }, [content]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), 2800);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    try {
      localStorage.setItem('md-inspector-theme', theme);
    } catch {
      // Private browsing may disable local storage; the theme still works for this session.
    }
  }, [theme]);

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.innerHTML = renderedHtml;
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, index) => {
      const item = analysis.outline[index];
      if (item) heading.id = item.id;
    });
    root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    });
    highlightTextNodes(root, searchQuery);
  }, [renderedHtml, analysis.outline, searchQuery]);

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    setIsDirty(true);
  };

  const setDocument = (nextContent: string, nextName: string, sourceFile: File | null = null) => {
    setContent(nextContent);
    setFileName(nextName);
    setLoadedFile(sourceFile);
    setIsDirty(false);
    setSearchQuery('');
    setSearchCursor(0);
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(md|markdown)$/i.test(file.name)) {
      showNotice('請選擇 .md 或 .markdown 檔案。');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    try {
      setDocument(await file.text(), file.name, file);
      showNotice(`已載入 ${file.name}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      showNotice('無法讀取這個檔案，請確認它是有效的文字檔。');
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void loadFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files?.[0]);
  };

  const reloadDocument = async () => {
    if (loadedFile) {
      try {
        setContent(await loadedFile.text());
        setIsDirty(false);
        setSearchQuery('');
        showNotice('已還原檔案原始內容');
        return;
      } catch {
        showNotice('無法重新讀取檔案，已改載入範例文件。');
      }
    }
    setDocument(SAMPLE_MARKDOWN, 'quick-start.md');
    showNotice('已重新載入範例文件');
  };

  const clearDocument = () => {
    setDocument('', '未命名.md');
    setActiveTab('outline');
    showNotice('工作區已清除');
  };

  const loadSample = () => {
    setDocument(SAMPLE_MARKDOWN, 'quick-start.md');
    setActiveTab('outline');
    showNotice('已載入範例文件');
  };

  const jumpToSource = (line: number, start?: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const position = start ?? getLineStart(content, line);
    editor.focus();
    editor.setSelectionRange(position, Math.min(content.length, position + 1));
    editor.scrollTop = Math.max(0, (line - 3) * 24);
    if (window.matchMedia('(max-width: 768px)').matches) setViewMode('source');
  };

  const jumpToPreviewHeading = (id: string, line: number) => {
    if (window.matchMedia('(max-width: 768px)').matches) setViewMode('preview');
    requestAnimationFrame(() => {
      const target = previewRef.current?.querySelector(`#${CSS.escape(id)}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!target) jumpToSource(line);
    });
  };

  const navigateSearch = (direction: 1 | -1) => {
    if (!searchQuery || searchCount === 0) return;
    const matches = [...content.matchAll(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))];
    const nextCursor = (searchCursor + direction + matches.length) % matches.length;
    setSearchCursor(nextCursor);
    const match = matches[nextCursor];
    if (match?.index !== undefined) {
      const line = content.slice(0, match.index).split(/\r\n|\r|\n/).length;
      jumpToSource(line, match.index);
    }
  };

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateSearch(event.shiftKey ? -1 : 1);
    }
    if (event.key === 'Escape') setSearchQuery('');
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1600);
      showNotice('Markdown 已複製到剪貼簿');
    } catch {
      showNotice('無法存取剪貼簿，請直接選取並複製原始碼。');
    }
  };

  const downloadMarkdown = () => {
    const blobUrl = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fileName.toLowerCase().endsWith('.md') ? fileName : `${fileName.replace(/\.[^.]+$/, '') || 'document'}.md`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
    showNotice('Markdown 檔案已下載');
  };

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
      if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const filteredIssues = analysis.issues.filter((issue) => issueFilter === 'all' || issue.category === issueFilter);

  return (
    <div className={`app-shell theme-${theme}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
    }} onDrop={handleDrop}>
      <header className="topbar">
        <a className="brand-lockup" href="#top" aria-label="MD Inspector 首頁">
          <span className="brand-mark"><i className="bi bi-markdown" aria-hidden="true" /></span>
          <span className="brand-copy"><strong>MD <span>Inspector</span></strong><small>MARKDOWN WORKBENCH</small></span>
        </a>
        <div className="topbar-center"><span className="local-badge"><i className="bi bi-shield-check" /> 本機處理 · 文件不會上傳</span></div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={loadSample} title="載入範例文件" aria-label="載入範例文件"><i className="bi bi-stars" /></button>
          <button className="icon-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={theme === 'light' ? '切換深色模式' : '切換淺色模式'} aria-label={theme === 'light' ? '切換深色模式' : '切換淺色模式'}><i className={`bi ${theme === 'light' ? 'bi-moon-stars' : 'bi-sun'}`} /></button>
          <span className="topbar-divider" />
          <button className="avatar-button" type="button" title="Markdown 工作台">M</button>
        </div>
      </header>

      <main id="top" className="page-content">
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> 文件分析工作台</div>
            <h1>讓每份 Markdown，<span>一目了然。</span></h1>
            <p>檢視文件結構、預覽排版，並快速找到需要修正的地方。</p>
          </div>
          <div className="heading-actions">
            <button type="button" className="btn btn-soft" onClick={clearDocument}><i className="bi bi-trash3" /> 清除</button>
            <button type="button" className="btn btn-primary-gradient" onClick={() => fileInputRef.current?.click()}><i className="bi bi-folder2-open" /> 開啟 Markdown <kbd>⌘O</kbd></button>
            <input ref={fileInputRef} type="file" accept=".md,.markdown,text/markdown,text/plain" className="visually-hidden" onChange={handleFileChange} aria-label="選取 Markdown 檔案" />
          </div>
        </section>

        <section className="stats-grid" aria-label="文件概覽">
          <StatCard icon="bi-text-paragraph" label="字數" value={formatNumber(wordCount)} hint="可讀內容" tone="violet" />
          <StatCard icon="bi-type" label="字元" value={formatNumber(characterCount)} hint="含空白" tone="blue" />
          <StatCard icon="bi-list-ol" label="行數" value={formatNumber(lineCount)} hint="原始碼" tone="mint" />
          <StatCard icon="bi-clock-history" label="閱讀時間" value={`${readingTime} 分`} hint="約略估算" tone="amber" />
          <StatCard icon="bi-file-earmark-code" label="檔案大小" value={formatBytes(fileBytes)} hint="UTF-8 計算" tone="rose" />
        </section>

        <div className="document-toolbar">
          <div className="document-identity">
            <span className="file-icon"><i className="bi bi-markdown" /></span>
            <div className="file-meta"><strong title={fileName}>{fileName}</strong><span>{isDirty ? <><i className="dirty-dot" /> 未儲存變更</> : 'Markdown 文件'}</span></div>
          </div>
          <div className="toolbar-search">
            <i className="bi bi-search" />
            <input ref={searchRef} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchCursor(0); }} onKeyDown={handleSearchKey} type="search" placeholder="搜尋文件內容…" aria-label="搜尋 Markdown 內容" />
            {searchQuery && <span className="search-count">{searchCount ? `${Math.min(searchCursor + 1, searchCount)} / ${searchCount}` : '無結果'}</span>}
            <div className="search-stepper">
              <button type="button" onClick={() => navigateSearch(-1)} disabled={!searchCount} aria-label="上一個搜尋結果"><i className="bi bi-chevron-up" /></button>
              <button type="button" onClick={() => navigateSearch(1)} disabled={!searchCount} aria-label="下一個搜尋結果"><i className="bi bi-chevron-down" /></button>
            </div>
            <kbd>⌘K</kbd>
          </div>
          <div className="toolbar-actions">
            <button className="toolbar-icon" type="button" onClick={() => void reloadDocument()} title="重新載入"><i className="bi bi-arrow-clockwise" /></button>
            <button className="toolbar-icon" type="button" onClick={() => void copyMarkdown()} title="複製 Markdown"><i className={`bi ${isCopied ? 'bi-check2' : 'bi-copy'}`} /></button>
            <button className="toolbar-icon" type="button" onClick={downloadMarkdown} title="下載 Markdown"><i className="bi bi-download" /></button>
            <span className="toolbar-separator" />
            <div className="view-switch" role="group" aria-label="檢視模式">
              <button type="button" className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')} title="並排檢視" aria-label="並排檢視"><i className="bi bi-layout-split" /></button>
              <button type="button" className={viewMode === 'source' ? 'active' : ''} onClick={() => setViewMode('source')} title="只看原始碼" aria-label="只看原始碼"><i className="bi bi-code-slash" /></button>
              <button type="button" className={viewMode === 'preview' ? 'active' : ''} onClick={() => setViewMode('preview')} title="只看預覽" aria-label="只看預覽"><i className="bi bi-eye" /></button>
            </div>
          </div>
        </div>

        <div className={`workspace-layout ${isDragging ? 'is-dragging' : ''}`} data-view={viewMode}>
          <section className="document-workspace" aria-label="Markdown 編輯與預覽">
            <article className="work-panel source-panel">
              <div className="panel-heading">
                <div className="panel-title"><span className="panel-icon source-icon"><i className="bi bi-code-square" /></span><div><strong>原始碼</strong><small>Markdown 編輯器</small></div></div>
                <span className="panel-status"><span className="live-dot" /> 即時同步</span>
              </div>
              <div className="editor-wrap">
                <div className="line-gutter" aria-hidden="true">{Array.from({ length: Math.max(lineCount, 1) }, (_, index) => <span key={index}>{String(index + 1).padStart(2, '0')}</span>)}</div>
                <textarea ref={editorRef} className="markdown-editor" spellCheck={false} value={content} onChange={handleContentChange} placeholder="在這裡輸入或貼上 Markdown…" aria-label="Markdown 原始碼編輯器" />
                {!content && <div className="empty-editor"><i className="bi bi-file-earmark-plus" /><strong>放入一份 Markdown</strong><span>拖放 .md 檔案，或直接在這裡輸入</span><button type="button" onClick={() => fileInputRef.current?.click()}>選取檔案 <i className="bi bi-arrow-right" /></button></div>}
              </div>
              <div className="panel-footer"><span><i className="bi bi-braces" /> Markdown</span><span>UTF-8 <b>·</b> {lineCount} 行</span></div>
            </article>

            <article className="work-panel preview-panel">
              <div className="panel-heading">
                <div className="panel-title"><span className="panel-icon preview-icon"><i className="bi bi-eye" /></span><div><strong>渲染預覽</strong><small>最終閱讀效果</small></div></div>
                <button className="preview-expand" type="button" onClick={() => setViewMode(viewMode === 'preview' ? 'split' : 'preview')} aria-label={viewMode === 'preview' ? '返回並排檢視' : '放大預覽'} title={viewMode === 'preview' ? '返回並排檢視' : '放大預覽'}><i className={`bi ${viewMode === 'preview' ? 'bi-arrows-angle-contract' : 'bi-arrows-angle-expand'}`} /></button>
              </div>
              <div className="preview-scroll"><div ref={previewRef} className="markdown-preview" /></div>
              <div className="panel-footer"><span><i className="bi bi-shield-lock" /> 安全渲染</span><span>{analysis.outline.length} 個標題 <b>·</b> {analysis.elements.length} 個元素</span></div>
            </article>
          </section>

          <aside className="inspector-panel" aria-label="文件檢查器">
            <div className="inspector-heading">
              <div><span className="inspector-kicker">INSPECTOR</span><h2>文件檢查</h2></div>
              <span className={`issue-count-pill ${issueCount ? 'has-issues' : 'is-clear'}`}><i className={`bi ${issueCount ? 'bi-exclamation-circle' : 'bi-check-circle'}`} /> {issueCount ? `${issueCount} 項` : '良好'}</span>
            </div>
            <div className="inspector-tabs" role="tablist" aria-label="檢查項目">
              <InspectorTabButton active={activeTab === 'outline'} icon="bi-list-nested" label="大綱" count={analysis.outline.length} onClick={() => setActiveTab('outline')} />
              <InspectorTabButton active={activeTab === 'issues'} icon="bi-shield-exclamation" label="問題" count={issueCount} onClick={() => setActiveTab('issues')} />
              <InspectorTabButton active={activeTab === 'elements'} icon="bi-grid" label="元素" count={analysis.elements.length} onClick={() => setActiveTab('elements')} />
            </div>
            <div className="inspector-body">
              {activeTab === 'outline' && <OutlinePanel outline={analysis.outline} onSelect={jumpToPreviewHeading} />}
              {activeTab === 'issues' && <IssuesPanel issues={filteredIssues} filter={issueFilter} onFilter={setIssueFilter} onSelect={jumpToSource} total={issueCount} errors={errorCount} />}
              {activeTab === 'elements' && <ElementsPanel elements={analysis.elements} onSelect={jumpToSource} />}
            </div>
            <div className="inspector-footer"><span className="footer-sparkle"><i className="bi bi-stars" /></span><span>每一個細節，都有跡可循。</span></div>
          </aside>
        </div>

        <footer className="app-footer"><span>MD Inspector <b>·</b> 在本機檢視你的 Markdown</span><a href="https://github.com/firecrawl/pdf-inspector" target="_blank" rel="noreferrer">開源靈感：Firecrawl PDF Inspector <i className="bi bi-box-arrow-up-right" /></a></footer>
      </main>

      {isDragging && <div className="drop-overlay" aria-live="polite"><div className="drop-card"><span><i className="bi bi-cloud-arrow-down" /></span><strong>放開以載入 Markdown</strong><small>只接受 .md 與 .markdown 檔案</small></div></div>}
      {notice && <div className="notice-toast" role="status"><i className="bi bi-check-circle-fill" /> {notice}</div>}
    </div>
  );
}

function StatCard({ icon, label, value, hint, tone }: { icon: string; label: string; value: string; hint: string; tone: string }) {
  return <article className="stat-card"><span className={`stat-icon tone-${tone}`}><i className={`bi ${icon}`} /></span><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></article>;
}

function InspectorTabButton({ active, icon, label, count, onClick }: { active: boolean; icon: string; label: string; count: number; onClick: () => void }) {
  return <button type="button" className={`inspector-tab ${active ? 'active' : ''}`} onClick={onClick} role="tab" aria-selected={active}><i className={`bi ${icon}`} /><span>{label}</span><small>{count}</small></button>;
}

function OutlinePanel({ outline, onSelect }: { outline: ReturnType<typeof analyzeMarkdown>['outline']; onSelect: (id: string, line: number) => void }) {
  if (!outline.length) return <EmptyPanel icon="bi-list-nested" title="還沒有文件大綱" text="新增一個 Markdown 標題，即可在此快速導覽。" />;
  return <div className="outline-list"><div className="section-caption">文件結構 <span>{outline.length} 個標題</span></div>{outline.map((item) => <button key={`${item.id}-${item.line}`} type="button" className="outline-item" style={{ '--outline-indent': `${Math.max(0, item.level - 1) * 14}px` } as CSSProperties} onClick={() => onSelect(item.id, item.line)}><span className={`heading-level heading-h${item.level}`}>H{item.level}</span><span className="outline-text" title={item.text}>{item.text}</span><small>{String(item.line).padStart(2, '0')}</small></button>)}</div>;
}

function IssuesPanel({ issues, filter, onFilter, onSelect, total, errors }: { issues: MarkdownIssue[]; filter: IssueFilter; onFilter: (value: IssueFilter) => void; onSelect: (line: number, start: number) => void; total: number; errors: number }) {
  const filters: { value: IssueFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'structure', label: '結構' },
    { value: 'links', label: '連結' },
    { value: 'syntax', label: '語法' },
  ];
  return <div className="issues-list"><div className="issue-summary"><span className={errors ? 'summary-error' : 'summary-good'}><i className={`bi ${errors ? 'bi-x-circle' : 'bi-check-circle'}`} /> {errors ? `${errors} 個錯誤` : '沒有錯誤'}</span><span>{total} 項提示</span></div><div className="filter-row" aria-label="依類型篩選問題">{filters.map((item) => <button key={item.value} type="button" onClick={() => onFilter(item.value)} className={filter === item.value ? 'active' : ''}>{item.label}</button>)}</div>{issues.length ? issues.map((issue) => <button className="issue-item" key={issue.id} type="button" onClick={() => onSelect(issue.line, issue.start)}><span className={`issue-mark ${issue.severity}`}><i className={`bi ${getIssueIcon(issue)}`} /></span><span className="issue-content"><span className="issue-title">{issue.title}</span><span className="issue-detail">{issue.detail}</span><span className="issue-meta"><span>{issueLabels[issue.category]}</span><span>第 {issue.line} 行</span></span></span><i className="bi bi-arrow-up-right issue-jump" /></button>) : <EmptyPanel icon={total ? 'bi-funnel' : 'bi-shield-check'} title={total ? '沒有符合的問題' : '文件狀態良好'} text={total ? '試著切換其他問題類型。' : '目前沒有偵測到常見格式問題。'} />}</div>;
}

function ElementsPanel({ elements, onSelect }: { elements: DocumentElement[]; onSelect: (line: number, start: number) => void }) {
  if (!elements.length) return <EmptyPanel icon="bi-grid" title="尚無可檢視元素" text="加入連結、圖片、表格、引用或程式碼區塊。" />;
  return <div className="elements-list"><div className="section-caption">文件元素 <span>{elements.length} 個項目</span></div>{elements.map((element) => <button key={element.id} type="button" className="element-item" onClick={() => onSelect(element.line, element.start)}><span className={`element-icon element-${element.type}`}><i className={`bi ${element.type === 'link' ? 'bi-link-45deg' : element.type === 'image' ? 'bi-image' : element.type === 'code' ? 'bi-code-slash' : element.type === 'table' ? 'bi-table' : 'bi-chat-square-quote'}`} /></span><span className="element-content"><strong>{element.label}</strong><small>{elementLabels[element.type]} · {element.detail}</small></span><span className="element-line">{String(element.line).padStart(2, '0')}</span></button>)}</div>;
}

function EmptyPanel({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty-panel"><span><i className={`bi ${icon}`} /></span><strong>{title}</strong><p>{text}</p></div>;
}

export default App;
