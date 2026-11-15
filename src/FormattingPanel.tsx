import { ARTICLE_STYLES, FONT_FAMILIES, type ArticleTypography, type ArticleStyleKey, type FontFamilyKey } from './formatting';

interface FormattingPanelProps {
  typography: ArticleTypography;
  onChange: (update: Partial<ArticleTypography>) => void;
  onCleanLayout: () => void;
  onRebuildTables: () => void;
  onDownloadHtml: () => void;
}

function RangeControl({ label, value, min, max, step, format, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return <label className="format-range">
    <span>{label}<output>{format(value)}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}

export default function FormattingPanel({ typography, onChange, onCleanLayout, onRebuildTables, onDownloadHtml }: FormattingPanelProps) {
  return <section className="formatting-panel" aria-label="文章美化與版面工具">
    <div className="formatting-heading">
      <div className="formatting-title"><span className="formatting-icon"><i className="bi bi-magic" /></span><div><strong>文章美化</strong><small>只調整預覽樣式，原始 Markdown 文字不變</small></div></div>
      <button type="button" className="format-export-button" onClick={onDownloadHtml}><i className="bi bi-filetype-html" /> 下載美化 HTML</button>
    </div>

    <div className="format-style-row">
      <span className="format-field-label">文章風格</span>
      <div className="format-style-options" role="group" aria-label="選擇文章風格">
        {ARTICLE_STYLES.map((style) => <button key={style.key} type="button" className={`format-style-option ${typography.style === style.key ? 'active' : ''}`} onClick={() => onChange({ style: style.key as ArticleStyleKey })} aria-pressed={typography.style === style.key}>
          <span className={`style-swatch swatch-${style.key}`} /><span><strong>{style.label}</strong><small>{style.description}</small></span>
        </button>)}
      </div>
    </div>

    <div className="format-controls-grid">
      <label className="format-select"><span>字體</span><select value={typography.font} onChange={(event) => onChange({ font: event.target.value as FontFamilyKey })}>{Object.entries(FONT_FAMILIES).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}</select></label>
      <RangeControl label="正文字級" value={typography.fontSize} min={13} max={22} step={1} format={(value) => `${value}px`} onChange={(value) => onChange({ fontSize: value })} />
      <RangeControl label="標題大小" value={typography.headingScale} min={0.85} max={1.4} step={0.05} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => onChange({ headingScale: value })} />
      <RangeControl label="行距" value={typography.lineHeight} min={1.45} max={2.2} step={0.05} format={(value) => value.toFixed(2)} onChange={(value) => onChange({ lineHeight: value })} />
      <RangeControl label="段落間距" value={typography.paragraphGap} min={0.4} max={2} step={0.1} format={(value) => `${value.toFixed(1)} em`} onChange={(value) => onChange({ paragraphGap: value })} />
    </div>

    <div className="format-actions">
      <span className="format-hint"><i className="bi bi-info-circle" /> 清理與表格修復會更新左側 Markdown 原始碼。</span>
      <div>
        <button type="button" className="format-tool-button" onClick={onCleanLayout}><i className="bi bi-text-indent-left" /> 清理版面</button>
        <button type="button" className="format-tool-button" onClick={onRebuildTables}><i className="bi bi-table" /> 重建表格</button>
      </div>
    </div>
  </section>;
}
