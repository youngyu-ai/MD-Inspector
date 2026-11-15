const CLIPBOARD_STYLE_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'color',
  'background-color',
  'text-align',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'text-underline-offset',
  'text-indent',
  'letter-spacing',
  'word-spacing',
  'white-space',
  'vertical-align',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-collapse',
  'border-spacing',
  'border-radius',
  'list-style-type',
  'list-style-position',
] as const;

type CopyResult = 'rich' | 'plain';

function snapshotStyles(element: HTMLElement): Map<string, string> {
  const computed = window.getComputedStyle(element);
  const styles = new Map<string, string>();
  for (const property of CLIPBOARD_STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (value) styles.set(property, value);
  }

  if (element.tagName === 'TABLE') styles.set('width', '100%');
  if (element.tagName === 'IMG') {
    const width = computed.getPropertyValue('width');
    const height = computed.getPropertyValue('height');
    if (width && width !== 'auto') styles.set('width', width);
    if (height && height !== 'auto') styles.set('height', height);
    styles.set('max-width', '100%');
  }

  return styles;
}

function inlinePreviewStyles(preview: HTMLElement): HTMLElement {
  const staging = preview.cloneNode(false) as HTMLElement;
  staging.className = preview.className;
  staging.style.cssText = preview.style.cssText;
  staging.innerHTML = preview.innerHTML;

  staging.querySelectorAll('mark.search-hit').forEach((marker) => {
    marker.replaceWith(...Array.from(marker.childNodes));
  });

  staging.setAttribute('aria-hidden', 'true');
  staging.style.position = 'fixed';
  staging.style.left = '-100000px';
  staging.style.top = '0';
  staging.style.width = `${Math.max(preview.getBoundingClientRect().width, 320)}px`;
  staging.style.visibility = 'hidden';
  staging.style.pointerEvents = 'none';
  staging.style.zIndex = '-1';
  document.body.append(staging);

  try {
    const elements = [staging, ...Array.from(staging.querySelectorAll<HTMLElement>('*'))];
    const computedStyles = elements.map(snapshotStyles);
    computedStyles.forEach((styles) => styles.set('color', '#000000'));
    computedStyles[0].set('background-color', '#ffffff');

    elements.forEach((element, index) => {
      if (element instanceof HTMLAnchorElement && element.hasAttribute('href')) {
        element.href = element.href;
      }
      if (element instanceof HTMLImageElement && element.hasAttribute('src')) {
        element.src = element.src;
      }

      element.removeAttribute('class');
      element.removeAttribute('id');
      element.removeAttribute('target');
      element.removeAttribute('rel');
      element.removeAttribute('tabindex');
      element.removeAttribute('aria-hidden');
      element.removeAttribute('contenteditable');
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name.startsWith('data-')) element.removeAttribute(attribute.name);
      }
      element.removeAttribute('style');

      computedStyles[index].forEach((value, property) => {
        element.style.setProperty(property, value);
      });
    });

    return staging;
  } catch (error) {
    staging.remove();
    throw error;
  }
}

function copyHtmlWithSelection(html: string): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const previousRanges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const holder = document.createElement('div');
  holder.contentEditable = 'true';
  holder.setAttribute('aria-hidden', 'true');
  holder.style.position = 'fixed';
  holder.style.left = '-100000px';
  holder.style.top = '0';
  holder.style.opacity = '0';
  holder.innerHTML = html;
  document.body.append(holder);

  let copied = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(holder);
    selection.removeAllRanges();
    selection.addRange(range);
    copied = document.execCommand('copy');
  } finally {
    selection.removeAllRanges();
    previousRanges.forEach((range) => selection.addRange(range));
    holder.remove();
    activeElement?.focus({ preventScroll: true });
  }

  return copied;
}

export async function copyRichPreview(preview: HTMLElement): Promise<CopyResult> {
  const staging = inlinePreviewStyles(preview);
  const html = staging.outerHTML;
  const plainText = preview.innerText || preview.textContent || '';
  staging.remove();

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return 'rich';
    } catch {
      if (copyHtmlWithSelection(html)) return 'rich';
    }
  } else if (copyHtmlWithSelection(html)) {
    return 'rich';
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plainText);
    return 'plain';
  }

  throw new Error('Rich clipboard access is unavailable in this browser.');
}
