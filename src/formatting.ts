export type ArticleStyleKey = 'editorial' | 'classic' | 'minimal';
export type FontFamilyKey = 'sans' | 'serif' | 'system';

export interface ArticleStyle {
  key: ArticleStyleKey;
  label: string;
  description: string;
  accent: string;
  accentSoft: string;
  ink: string;
  border: string;
  surface: string;
}

export interface ArticleTypography {
  style: ArticleStyleKey;
  font: FontFamilyKey;
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  headingScale: number;
}

export const ARTICLE_STYLES: ArticleStyle[] = [
  { key: 'editorial', label: '雜誌編輯', description: '鮮明標題與紫色重點', accent: '#6255e8', accentSoft: '#f1efff', ink: '#29283b', border: '#e8e6f2', surface: '#ffffff' },
  { key: 'classic', label: '典雅長文', description: '襯線字體與溫暖棕色', accent: '#96623c', accentSoft: '#f6efe8', ink: '#382f29', border: '#e8ded4', surface: '#fffdf9' },
  { key: 'minimal', label: '清爽極簡', description: '留白層次與青綠重點', accent: '#177d73', accentSoft: '#eaf5f2', ink: '#273a39', border: '#dce9e6', surface: '#fcfefd' },
];

export const FONT_FAMILIES: Record<FontFamilyKey, { label: string; css: string }> = {
  sans: { label: '黑體・易讀', css: "'DM Sans', 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  serif: { label: '襯線・長文', css: "'Noto Serif TC', 'Songti TC', 'PMingLiU', Georgia, serif" },
  system: { label: '系統・原生', css: "system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif" },
};

function splitPipeRow(line: string): string[] | null {
  if (!line.includes('|')) return null;
  const cells: string[] = [];
  let start = 0;
  let codeTicks = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '`') {
      let end = index + 1;
      while (line[end] === '`') end += 1;
      const run = end - index;
      if (!codeTicks) codeTicks = run;
      else if (codeTicks === run) codeTicks = 0;
      index = end - 1;
      continue;
    }
    if (char === '|' && codeTicks === 0) {
      cells.push(line.slice(start, index).trim());
      start = index + 1;
    }
  }
  cells.push(line.slice(start).trim());
  if (line.trimStart().startsWith('|')) cells.shift();
  if (line.trimEnd().endsWith('|')) cells.pop();
  return cells.length ? cells : null;
}

function parseTableRow(line: string): string[] | null {
  if (line.includes('|')) return splitPipeRow(line);
  if (line.includes('\t')) {
    const cells = line.split('\t').map((cell) => cell.trim());
    return cells.length > 1 ? cells : null;
  }
  return null;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

function alignmentForCell(cell: string): 'left' | 'center' | 'right' {
  const value = cell.replace(/\s/g, '');
  const left = value.startsWith(':');
  const right = value.endsWith(':');
  if (left && right) return 'center';
  return right ? 'right' : 'left';
}

function visibleWidth(value: string): number {
  return [...value].reduce((width, character) => {
    return width + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\uFF01-\uFF60]/u.test(character) ? 2 : 1);
  }, 0);
}

function normalizeTable(rows: string[][]): string[] {
  const separatorIndex = rows.findIndex(isSeparatorRow);
  const separator = separatorIndex >= 0 ? rows[separatorIndex] : null;
  const dataRows = rows.filter((row) => !isSeparatorRow(row));
  const columnCount = Math.max(1, ...dataRows.map((row) => row.length), separator?.length ?? 0);
  const normalizedRows = dataRows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ''));
  const header = normalizedRows[0] ?? Array.from({ length: columnCount }, () => '');
  const alignments = separator
    ? Array.from({ length: columnCount }, (_, index) => alignmentForCell(separator[index] ?? '---'))
    : Array.from({ length: columnCount }, () => 'left' as const);
  const widths = Array.from({ length: columnCount }, (_, column) => Math.max(3, ...normalizedRows.map((row) => visibleWidth(row[column] ?? ''))));
  const formatCells = (cells: string[]) => `| ${cells.map((cell, index) => `${cell}${' '.repeat(Math.max(0, widths[index] - visibleWidth(cell)))}`).join(' | ')} |`;
  const divider = `| ${widths.map((width, index) => {
    const dashes = '-'.repeat(width);
    if (alignments[index] === 'center') return `:${dashes.slice(1, -1) || '-'}:`;
    if (alignments[index] === 'right') return `${dashes.slice(1)}:`;
    return `:${dashes.slice(1)}`;
  }).join(' | ')} |`;
  const remainingRows = normalizedRows.slice(1);
  return [formatCells(header), divider, ...remainingRows.map(formatCells)];
}

function isFence(line: string): { marker: string; length: number } | null {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  return match ? { marker: match[1][0], length: match[1].length } : null;
}

export function cleanMarkdownLayout(source: string): { text: string; changed: boolean; blankLinesRemoved: number; trailingSpaceLines: number } {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let fence: { marker: string; length: number } | null = null;
  let blankLinesRemoved = 0;
  let trailingSpaceLines = 0;

  for (const line of lines) {
    const marker = isFence(line);
    if (fence) {
      output.push(line);
      if (marker && marker.marker === fence.marker && marker.length >= fence.length && !line.slice(line.indexOf(marker.marker) + marker.length).trim()) fence = null;
      continue;
    }
    if (marker) {
      fence = marker;
      output.push(line);
      continue;
    }
    const trailing = line.match(/[ \t]+$/)?.[0] ?? '';
    if (trailing.length) trailingSpaceLines += 1;
    const preservedHardBreak = trailing.length >= 2 ? '  ' : '';
    const normalizedLine = `${line.slice(0, line.length - trailing.length)}${preservedHardBreak}`;
    if (!normalizedLine.trim()) {
      if (output.at(-1) === '') {
        blankLinesRemoved += 1;
        continue;
      }
      output.push('');
    } else {
      output.push(normalizedLine);
    }
  }

  while (output[0] === '') { output.shift(); blankLinesRemoved += 1; }
  while (output.at(-1) === '') { output.pop(); blankLinesRemoved += 1; }
  const text = output.join('\n');
  return { text, changed: text !== source, blankLinesRemoved, trailingSpaceLines };
}

export function rebuildMarkdownTables(source: string): { text: string; rebuiltTables: number; changed: boolean } {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let fence: { marker: string; length: number } | null = null;
  let rebuiltTables = 0;

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const marker = isFence(line);
    if (fence) {
      output.push(line);
      if (marker && marker.marker === fence.marker && marker.length >= fence.length && !line.slice(line.indexOf(marker.marker) + marker.length).trim()) fence = null;
      index += 1;
      continue;
    }
    if (marker) {
      fence = marker;
      output.push(line);
      index += 1;
      continue;
    }
    const firstRow = parseTableRow(line);
    if (!firstRow || firstRow.length < 2) {
      output.push(line);
      index += 1;
      continue;
    }
    const candidateRows: string[][] = [];
    let end = index;
    while (end < lines.length && !isFence(lines[end])) {
      const row = parseTableRow(lines[end]);
      if (!row || row.length < 2) break;
      candidateRows.push(row);
      end += 1;
    }
    const containsSeparator = candidateRows.some(isSeparatorRow);
    if (candidateRows.length >= 2 && (containsSeparator || candidateRows.every((row) => row.length >= 2))) {
      const normalized = normalizeTable(candidateRows);
      output.push(...normalized);
      rebuiltTables += 1;
      index = end;
    } else {
      output.push(line);
      index += 1;
    }
  }

  if (!rebuiltTables) return { text: source, rebuiltTables: 0, changed: false };
  const text = output.join('\n');
  return { text, rebuiltTables, changed: text !== source };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function createStyledHtmlDocument(title: string, bodyHtml: string, typography: ArticleTypography): string {
  const style = ARTICLE_STYLES.find((candidate) => candidate.key === typography.style) ?? ARTICLE_STYLES[0];
  const font = FONT_FAMILIES[typography.font] ?? FONT_FAMILIES.sans;
  const safeTitle = escapeHtml(title);
  const fontSize = Math.min(22, Math.max(13, typography.fontSize));
  const lineHeight = Math.min(2.2, Math.max(1.45, typography.lineHeight));
  const paragraphGap = Math.min(2, Math.max(0.4, typography.paragraphGap));
  const headingScale = Math.min(1.4, Math.max(0.85, typography.headingScale));
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
:root{color-scheme:light;--accent:${style.accent};--accent-soft:${style.accentSoft};--ink:${style.ink};--border:${style.border};--paper:${style.surface};--article-font:${font.css};--article-size:${fontSize}px;--article-leading:${lineHeight};--paragraph-gap:${paragraphGap}em;--heading-scale:${headingScale}}
*{box-sizing:border-box}body{margin:0;padding:48px 22px;background:#f4f5f8;color:var(--ink);font-family:var(--article-font)}article{max-width:820px;margin:0 auto;padding:clamp(26px,6vw,64px);border:1px solid var(--border);border-radius:14px;background:var(--paper);box-shadow:0 10px 38px #2529420c;font-size:var(--article-size);line-height:var(--article-leading);overflow-wrap:anywhere}article>:first-child{margin-top:0}h1,h2,h3,h4,h5,h6{color:var(--ink);line-height:1.35}h1{font-size:calc(2.15em * var(--heading-scale));padding-bottom:.45em;border-bottom:2px solid var(--accent);margin:0 0 1em}h2{font-size:calc(1.65em * var(--heading-scale));margin:1.8em 0 .6em}h3{font-size:calc(1.3em * var(--heading-scale));margin:1.5em 0 .5em}h4,h5,h6{font-size:calc(1.08em * var(--heading-scale));margin:1.3em 0 .45em}p,ul,ol,blockquote,table,pre{margin:0 0 var(--paragraph-gap)}li{margin:.28em 0}a{color:var(--accent);text-underline-offset:3px}strong{color:var(--ink)}blockquote{padding:.8em 1em;border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0}table{width:100%;border-collapse:collapse}th,td{padding:.65em .75em;border:1px solid var(--border);text-align:left;vertical-align:top}th{background:var(--accent-soft)}img{max-width:100%;height:auto;border-radius:6px}hr{border:0;border-top:1px solid var(--border);margin:1.8em 0}code{padding:.12em .32em;border-radius:4px;background:var(--accent-soft);font-family:ui-monospace,monospace}pre{overflow:auto;padding:1em;border-radius:9px;background:#252640;color:#f1f2ff}pre code{padding:0;background:none;color:inherit}@media print{body{padding:0;background:white}article{max-width:none;border:0;box-shadow:none;padding:0}}
</style>
</head>
<body><article class="style-${style.key}">${bodyHtml}</article></body>
</html>`;
}
