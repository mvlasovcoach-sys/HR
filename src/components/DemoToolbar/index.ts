// DO NOT MODIFY WITHOUT DESIGN APPROVAL: Demo Toolbar is locked.

const STORAGE_KEY = 'demo-lang';
const FALLBACK_LOWER_KEY = 'hr:lang';
const LANG_OPTIONS = ['EN', 'NL', 'RU'] as const;
type DemoLang = (typeof LANG_OPTIONS)[number];
const DEFAULT_LANG: DemoLang = 'EN';

const styles = `
  :host {
    display: block;
    width: 100%;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: nowrap;
    min-height: 64px;
    padding: 16px 20px;
    border-radius: 18px;
    border: 1px solid rgba(43, 217, 178, 0.12);
    background: linear-gradient(135deg, rgba(8, 26, 33, 0.92), rgba(5, 18, 24, 0.88));
    box-shadow: 0 18px 32px rgba(4, 18, 24, 0.45);
    backdrop-filter: blur(18px);
    color: #e6f3f7;
  }
  h1 {
    margin: 0;
    font: 700 clamp(22px, 2.6vw, 32px) / 1.2 "Inter", system-ui, sans-serif;
    letter-spacing: -0.01em;
    white-space: nowrap;
    min-width: 0;
  }
  .spacer {
    flex: 1;
    min-width: 12px;
  }
  nav {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
  }
  button {
    border: 1px solid rgba(29, 209, 180, 0.7);
    background: transparent;
    color: inherit;
    padding: 8px 16px;
    border-radius: 18px;
    font: 600 15px/1.2 "Inter", system-ui, sans-serif;
    letter-spacing: 0.02em;
    cursor: pointer;
    outline: none;
    transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
  }
  button:focus {
    outline: none;
  }
  button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(7, 24, 31, 0.95), 0 0 0 4px rgba(29, 209, 180, 0.9);
  }
  button[aria-pressed="true"] {
    background: rgba(29, 209, 180, 0.12);
    border-color: rgba(29, 209, 180, 0.95);
  }
  button:not([aria-pressed="true"]):hover {
    transform: translateY(-1px);
  }
  button[disabled] {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
  }
  .export {
    min-width: 116px;
  }
  @media (max-width: 720px) {
    header {
      flex-wrap: wrap;
      row-gap: 10px;
      padding: 14px 16px;
    }
    nav {
      order: 3;
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .export {
      order: 2;
    }
  }
`;

function normaliseLang(value: string | null | undefined): DemoLang | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (LANG_OPTIONS as readonly string[]).includes(upper) ? (upper as DemoLang) : null;
}

interface LangChangeDetail {
  lang: DemoLang;
}

type DemoToolbarEventListener = EventListener | null;

class DemoToolbarElement extends HTMLElement {
  private langValue: DemoLang = DEFAULT_LANG;
  private readonly shadow: ShadowRoot;
  private langButtons: HTMLButtonElement[] = [];
  private exportButton: HTMLButtonElement | null = null;
  private suppressAttributeSync = false;
  private onLangChangeHandler: DemoToolbarEventListener = null;
  private onExportHandler: DemoToolbarEventListener = null;
  private isMounted = false;

  static get observedAttributes(): string[] {
    return ['lang', 'export-disabled', 'export-label', 'export-empty-label'];
  }

  constructor() {
    super();
    this.setAttribute('data-testid', 'demo-toolbar');
    this.shadow = this.attachShadow({ mode: 'open' });
    this.handleLangClick = this.handleLangClick.bind(this);
    this.handleExportClick = this.handleExportClick.bind(this);
    this.render();
  }

  connectedCallback(): void {
    this.isMounted = true;
    const attrLang = normaliseLang(this.getAttribute('lang'));
    const storedLang = this.readStoredLang();
    const initial = attrLang ?? storedLang ?? DEFAULT_LANG;
    this.applyLang(initial, { emit: true, persist: false, reflect: true });
    this.updateExportLabels();
    this.updateExportState();
  }

  disconnectedCallback(): void {
    this.isMounted = false;
    this.langButtons.forEach(button => button.removeEventListener('click', this.handleLangClick));
    this.exportButton?.removeEventListener('click', this.handleExportClick);
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'lang') {
      if (this.suppressAttributeSync) {
        return;
      }
      const resolved = normaliseLang(newValue) ?? DEFAULT_LANG;
      this.applyLang(resolved, { emit: this.isMounted, persist: false, reflect: false });
    } else if (name === 'export-disabled') {
      this.updateExportState();
    } else if (name === 'export-label' || name === 'export-empty-label') {
      this.updateExportLabels();
      this.updateExportState();
    }
  }

  get lang(): DemoLang {
    return this.langValue;
  }

  set lang(value: string | DemoLang) {
    const resolved = normaliseLang(typeof value === 'string' ? value : String(value));
    if (!resolved) return;
    this.applyLang(resolved, { emit: true, persist: false, reflect: true });
  }

  get exportDisabled(): boolean {
    return this.hasAttribute('export-disabled');
  }

  set exportDisabled(value: boolean) {
    if (value) {
      this.setAttribute('export-disabled', '');
    } else {
      this.removeAttribute('export-disabled');
    }
  }

  get onLangChange(): DemoToolbarEventListener {
    return this.onLangChangeHandler;
  }

  set onLangChange(handler: DemoToolbarEventListener) {
    this.setHandler('demo:langChanged', handler, 'onLangChangeHandler');
  }

  get onExport(): DemoToolbarEventListener {
    return this.onExportHandler;
  }

  set onExport(handler: DemoToolbarEventListener) {
    this.setHandler('demo:export', handler, 'onExportHandler');
  }

  private render(): void {
    const wrapper = document.createElement('template');
    wrapper.innerHTML = `
      <style>${styles}</style>
      <header class="wrap" part="header" role="region" aria-label="Demo toolbar">
        <h1 class="title" part="title">Demo</h1>
        <div class="spacer" aria-hidden="true"></div>
        <nav class="langs" role="tablist" aria-label="Language" part="lang-group">
          ${LANG_OPTIONS.map(lang => `
            <button type="button" class="btn" part="lang-button" data-lang="${lang}" aria-pressed="false">${lang}</button>
          `).join('')}
        </nav>
        <button type="button" class="export" part="export-button" data-role="export" aria-label="Export Demo data">Export</button>
      </header>
    `;
    this.shadow.replaceChildren(wrapper.content.cloneNode(true));
    this.langButtons = Array.from(this.shadow.querySelectorAll<HTMLButtonElement>('[data-lang]'));
    this.exportButton = this.shadow.querySelector<HTMLButtonElement>('[data-role="export"]');
    this.langButtons.forEach(button => button.addEventListener('click', this.handleLangClick));
    this.exportButton?.addEventListener('click', this.handleExportClick);
  }

  private handleLangClick(event: Event): void {
    const button = event.currentTarget as HTMLButtonElement | null;
    if (!button) return;
    const next = normaliseLang(button.dataset.lang);
    if (!next) return;
    this.applyLang(next, { emit: true, persist: true, reflect: true });
  }

  private handleExportClick(event: Event): void {
    if (this.exportDisabled || this.exportButton?.disabled) {
      event.preventDefault();
      return;
    }
    this.dispatchEvent(new CustomEvent('demo:export', { bubbles: true, composed: true }));
  }

  private applyLang(lang: DemoLang, options: { emit: boolean; persist: boolean; reflect: boolean }): void {
    if (this.langValue === lang && !options.reflect) {
      return;
    }
    this.langValue = lang;
    this.updateLangButtons(lang);
    if (options.reflect) {
      this.reflectLangAttribute(lang);
    }
    if (options.persist) {
      this.persistLang(lang);
    }
    if (options.emit) {
      this.dispatchEvent(new CustomEvent<LangChangeDetail>('demo:langChanged', { detail: { lang }, bubbles: true, composed: true }));
    }
  }

  private updateLangButtons(active: DemoLang): void {
    this.langButtons.forEach(button => {
      const isActive = normaliseLang(button.dataset.lang) === active;
      button.setAttribute('aria-pressed', String(isActive));
      if (isActive) {
        button.setAttribute('data-active', 'true');
      } else {
        button.removeAttribute('data-active');
      }
    });
  }

  private updateExportLabels(): void {
    if (!this.exportButton) return;
    this.exportButton.textContent = this.exportLabel;
    this.exportButton.setAttribute('aria-label', this.exportLabel);
  }

  private updateExportState(): void {
    if (!this.exportButton) return;
    const disabled = this.exportDisabled;
    this.exportButton.disabled = disabled;
    if (disabled) {
      this.exportButton.setAttribute('aria-disabled', 'true');
      this.exportButton.setAttribute('title', this.exportEmptyLabel);
    } else {
      this.exportButton.removeAttribute('aria-disabled');
      this.exportButton.setAttribute('title', this.exportLabel);
    }
  }

  private get exportLabel(): string {
    const attr = this.getAttribute('export-label');
    return attr && attr.trim() ? attr.trim() : 'Export';
  }

  private get exportEmptyLabel(): string {
    const attr = this.getAttribute('export-empty-label');
    return attr && attr.trim() ? attr.trim() : 'No data to export';
  }

  private reflectLangAttribute(lang: DemoLang): void {
    this.suppressAttributeSync = true;
    this.setAttribute('lang', lang);
    this.suppressAttributeSync = false;
  }

  private persistLang(lang: DemoLang): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      localStorage.setItem(FALLBACK_LOWER_KEY, lang.toLowerCase());
    } catch (error) {
      // Storage optional
    }
  }

  private readStoredLang(): DemoLang | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_LOWER_KEY) || '';
      return normaliseLang(stored);
    } catch (error) {
      return null;
    }
  }

  private setHandler(eventName: string, handler: DemoToolbarEventListener, key: 'onLangChangeHandler' | 'onExportHandler'): void {
    const current = this[key];
    if (current) {
      this.removeEventListener(eventName, current);
      this[key] = null;
    }
    if (typeof handler === 'function') {
      this.addEventListener(eventName, handler);
      this[key] = handler;
    }
  }
}

if (!customElements.get('demo-toolbar')) {
  customElements.define('demo-toolbar', DemoToolbarElement);
}

export { DemoToolbarElement };
export type { DemoLang };

declare global {
  interface HTMLElementTagNameMap {
    'demo-toolbar': DemoToolbarElement;
  }
}
