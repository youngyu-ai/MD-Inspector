export type IssueCategory = 'structure' | 'links' | 'syntax';
export type IssueSeverity = 'error' | 'warning';
export type ElementType = 'link' | 'image' | 'code' | 'table' | 'quote';

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  line: number;
  start: number;
}

export interface MarkdownIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  detail: string;
  line: number;
  column: number;
  start: number;
  excerpt: string;
}

export interface DocumentElement {
  id: string;
  type: ElementType;
  label: string;
  detail: string;
  line: number;
  start: number;
}

export interface MarkdownAnalysis {
  outline: OutlineItem[];
  issues: MarkdownIssue[];
  elements: DocumentElement[];
}

interface LineRecord {
  text: string;
  line: number;
  start: number;
}

function getLines(source: string): LineRecord[] {
  const texts = source.split(/\r\n|\r|\n/);
  let offset = 0;
  return texts.map((text, index) => {
    const record = { text, line: index + 1, start: offset };
    offset += text.length;
    if (offset < source.length) {
      offset += source[offset] === '\r' && source[offset + 1] === '\n' ? 2 : 1;
    }
    return record;
  });
}

function cleanHeading(raw: string): string {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}

function makeSlug(text: string, used: Set<string>): string {
  const base = text
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  let slug = base;
  let suffix = 2;
  while (used.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(slug);
  return slug;
}

export function analyzeMarkdown(source: string): MarkdownAnalysis {
  const lines = getLines(source);
  const outline: OutlineItem[] = [];
  const issues: MarkdownIssue[] = [];
  const elements: DocumentElement[] = [];
  const usedSlugs = new Set<string>();
  let previousHeadingLevel = 0;
  let issueSequence = 0;
  let elementSequence = 0;
  let openFence: { char: string; length: number; line: number; start: number; label: string } | null = null;
  const inlineTickCounts = new Map<number, { count: number; first: LineRecord }>();
  const emphasisCounts = new Map<string, { count: number; first: LineRecord }>();
  let inQuote = false;

  const addIssue = (
    line: LineRecord,
    category: IssueCategory,
    title: string,
    detail: string,
    severity: IssueSeverity = 'warning',
    column = 1,
  ) => {
    issueSequence += 1;
    issues.push({
      id: `issue-${issueSequence}`,
      category,
      severity,
      title,
      detail,
      line: line.line,
      column,
      start: line.start + Math.max(0, column - 1),
      excerpt: line.text.trim().slice(0, 100),
    });
  };

  const addElement = (line: LineRecord, type: ElementType, label: string, detail: string, start = line.start) => {
    elementSequence += 1;
    elements.push({ id: `element-${elementSequence}`, type, label, detail, line: line.line, start });
  };

  for (const [index, line] of lines.entries()) {
    const fenceMatch = line.text.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (openFence) {
      if (fenceMatch && fenceMatch[1][0] === openFence.char && fenceMatch[1].length >= openFence.length && !fenceMatch[2].trim()) {
        openFence = null;
      }
      inQuote = false;
      continue;
    }
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const language = fenceMatch[2].trim().split(/\s+/)[0] || '純文字';
      openFence = { char: marker[0], length: marker.length, line: line.line, start: line.start, label: language };
      addElement(line, 'code', `程式碼區塊 · ${language}`, '程式碼區塊', line.start);
      inQuote = false;
      continue;
    }

    const headingMatch = line.text.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = cleanHeading(headingMatch[2]);
      const titleStart = line.start + line.text.indexOf(headingMatch[1]);
      outline.push({ id: makeSlug(title, usedSlugs), level, text: title || '未命名標題', line: line.line, start: titleStart });
      if (level > previousHeadingLevel + 1) {
        addIssue(line, 'structure', `標題跳級至 H${level}`, `前一個標題是 H${previousHeadingLevel || '無'}；請逐層建立標題階層，避免直接跳到 H${level}。`, 'warning', line.text.indexOf(headingMatch[1]) + 1);
      }
      previousHeadingLevel = level;
    }

    const imagePattern = /!\[([^\]]*)\]\(([^)]*)\)/g;
    for (const match of line.text.matchAll(imagePattern)) {
      const alt = (match[1] ?? '').trim();
      const url = (match[2] ?? '').trim();
      const start = line.start + (match.index ?? 0);
      addElement(line, 'image', alt || '未命名圖片', url || '沒有圖片網址', start);
      if (!alt) addIssue(line, 'links', '圖片缺少替代文字', '為圖片補上簡短的替代文字，讓使用輔助科技的讀者也能了解圖片內容。', 'warning', (match.index ?? 0) + 1);
      if (!url) addIssue(line, 'links', '圖片網址為空', '圖片語法中沒有提供圖片網址。', 'warning', (match.index ?? 0) + 1);
    }

    const linkPattern = /(^|[^!])\[([^\]]*)\]\(([^)]*)\)/g;
    for (const match of line.text.matchAll(linkPattern)) {
      const label = (match[2] ?? '').trim();
      const url = (match[3] ?? '').trim();
      const prefixLength = (match[1] ?? '').length;
      const matchStart = (match.index ?? 0) + prefixLength;
      if (label || url) addElement(line, 'link', label || '未命名連結', url || '沒有目標網址', line.start + matchStart);
      if (!label || !url) {
        addIssue(line, 'links', '空連結', !label ? '連結沒有可辨識的文字。' : '連結目標網址是空的。', 'warning', matchStart + 1);
      }
    }

    const nextLine = lines[index + 1]?.text ?? '';
    if (line.text.includes('|') && /^\s*\|?\s*:?-{3,}[^\n]*\|/.test(nextLine)) {
      addElement(line, 'table', 'Markdown 表格', '表格標題列', line.start);
    }

    const quoteLine = /^\s{0,3}>/.test(line.text);
    if (quoteLine && !inQuote) addElement(line, 'quote', line.text.replace(/^\s{0,3}>\s?/, '').slice(0, 48) || '引用區塊', '引用區塊', line.start);
    inQuote = quoteLine;

    const inlineCodePattern = /(?<!\\)`+/g;
    for (const match of line.text.matchAll(inlineCodePattern)) {
      const length = match[0].length;
      const state = inlineTickCounts.get(length) ?? { count: 0, first: line };
      if (state.count % 2 === 0) state.first = line;
      state.count += 1;
      inlineTickCounts.set(length, state);
    }

    for (const marker of ['**', '__']) {
      const escapedMarker = marker === '**' ? /(?<!\\)\*\*/g : /(?<!\\)__/g;
      const count = [...line.text.matchAll(escapedMarker)].length;
      if (count) {
        const state = emphasisCounts.get(marker) ?? { count: 0, first: line };
        if (state.count % 2 === 0) state.first = line;
        state.count += count;
        emphasisCounts.set(marker, state);
      }
    }

    if (/!?\[[^\]]*\]\([^)]*$/.test(line.text)) {
      addIssue(line, 'syntax', '連結語法未閉合', '連結或圖片語法缺少結尾的右括號。', 'warning', Math.max(1, line.text.lastIndexOf('[') + 1));
    }
  }

  if (openFence) {
    const line = lines[openFence.line - 1] ?? { text: '', line: openFence.line, start: openFence.start };
    addIssue(line, 'syntax', '程式碼區塊未閉合', `第 ${openFence.line} 行的 ${openFence.char.repeat(openFence.length)} 程式碼區塊沒有結束標記。`, 'error');
  }

  inlineTickCounts.forEach((state, length) => {
    if (state.count % 2 === 1) addIssue(state.first, 'syntax', '行內程式碼未閉合', `有一組 ${'`'.repeat(length)} 標記沒有配對。`, 'warning');
  });
  emphasisCounts.forEach((state, marker) => {
    if (state.count % 2 === 1) addIssue(state.first, 'syntax', '粗體標記未閉合', `文件中有未配對的 ${marker} 標記。`, 'warning');
  });

  return { outline, issues, elements };
}

export function getLineStart(source: string, targetLine: number): number {
  if (targetLine <= 1) return 0;
  let line = 1;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      line += 1;
      if (line === targetLine) return index + 1;
    } else if (source[index] === '\r') {
      if (source[index + 1] === '\n') index += 1;
      line += 1;
      if (line === targetLine) return index + 1;
    }
  }
  return source.length;
}
