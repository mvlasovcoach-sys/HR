// DO NOT MODIFY WITHOUT DESIGN APPROVAL: Demo Toolbar is locked.

const STORAGE_KEY = 'demo-lang';
const FALLBACK_LOWER_KEY = 'hr:lang';
const LANG_OPTIONS = ['EN', 'NL', 'RU'];
const DEFAULT_LANG = 'EN';

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

function normaliseLang(value) {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  return LANG_OPTIONS.includes(upper) ? upper : null;
}

class DemoToolbarElement extends HTMLElement {
  static get observedAttributes() {
    return ['lang', 'export-disabled', 'export-label', 'export-empty-label'];
  }

  constructor() {
    super();
    this.setAttribute('data-testid', 'demo-toolbar');
    this.langValue = DEFAULT_LANG;
    this.shadow = this.attachShadow({ mode: 'open' });
    this.langButtons = [];
    this.exportButton = null;
    this.suppressAttributeSync = false;
    this.onLangChangeHandler = null;
    this.onExportHandler = null;
    this.isMounted = false;

    this.handleLangClick = this.handleLangClick.bind(this);
    this.handleExportClick = this.handleExportClick.bind(this);
    this.render();
  }

  connectedCallback() {
    this.isMounted = true;
    const attrLang = normaliseLang(this.getAttribute('lang'));
    const storedLang = this.readStoredLang();
    const initial = attrLang || storedLang || DEFAULT_LANG;
    this.applyLang(initial, { emit: true, persist: false, reflect: true });
    this.updateExportLabels();
    this.updateExportState();
  }

  disconnectedCallback() {
    this.isMounted = false;
    this.langButtons.forEach(button => button.removeEventListener('click', this.handleLangClick));
    if (this.exportButton) {
      this.exportButton.removeEventListener('click', this.handleExportClick);
    }
  }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === 'lang') {
      if (this.suppressAttributeSync) {
        return;
      }
      const resolved = normaliseLang(newValue) || DEFAULT_LANG;
      this.applyLang(resolved, { emit: this.isMounted, persist: false, reflect: false });
    } else if (name === 'export-disabled') {
      this.updateExportState();
    } else if (name === 'export-label' || name === 'export-empty-label') {
      this.updateExportLabels();
      this.updateExportState();
    }
  }

  get lang() {
    return this.langValue;
  }

  set lang(value) {
    const resolved = normaliseLang(typeof value === 'string' ? value : String(value));
    if (!resolved) return;
    this.applyLang(resolved, { emit: true, persist: false, reflect: true });
  }

  get exportDisabled() {
    return this.hasAttribute('export-disabled');
  }

  set exportDisabled(value) {
    if (value) {
      this.setAttribute('export-disabled', '');
    } else {
      this.removeAttribute('export-disabled');
    }
  }

  get onLangChange() {
    return this.onLangChangeHandler;
  }

  set onLangChange(handler) {
    this.setHandler('demo:langChanged', handler, 'onLangChangeHandler');
  }

  get onExport() {
    return this.onExportHandler;
  }

  set onExport(handler) {
    this.setHandler('demo:export', handler, 'onExportHandler');
  }

  render() {
    const template = document.createElement('template');
    template.innerHTML = `
      <style>${styles}</style>
      <header class="wrap" part="header" role="region" aria-label="Demo toolbar">
        <h1 class="title" part="title">Demo</h1>
        <div class="spacer" aria-hidden="true"></div>
        <nav class="langs" role="tablist" aria-label="Language" part="lang-group">
          ${LANG_OPTIONS.map(lang => `<button type="button" class="btn" part="lang-button" data-lang="${lang}" aria-pressed="false">${lang}</button>`).join('')}
        </nav>
        <button type="button" class="export" part="export-button" data-role="export" aria-label="Export Demo data">Export</button>
      </header>
    `;
    this.shadow.replaceChildren(template.content.cloneNode(true));
    this.langButtons = Array.from(this.shadow.querySelectorAll('[data-lang]'));
    this.exportButton = this.shadow.querySelector('[data-role="export"]');
    this.langButtons.forEach(button => button.addEventListener('click', this.handleLangClick));
    if (this.exportButton) {
      this.exportButton.addEventListener('click', this.handleExportClick);
    }
  }

  handleLangClick(event) {
    const button = event.currentTarget;
    if (!button) return;
    const next = normaliseLang(button.dataset.lang);
    if (!next) return;
    this.applyLang(next, { emit: true, persist: true, reflect: true });
  }

  handleExportClick(event) {
    if (this.exportDisabled || (this.exportButton && this.exportButton.disabled)) {
      event.preventDefault();
      return;
    }
    this.dispatchEvent(new CustomEvent('demo:export', { bubbles: true, composed: true }));
  }

  applyLang(lang, options) {
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
      this.dispatchEvent(new CustomEvent('demo:langChanged', { detail: { lang }, bubbles: true, composed: true }));
    }
  }

  updateLangButtons(active) {
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

  updateExportLabels() {
    if (!this.exportButton) return;
    this.exportButton.textContent = this.exportLabel;
    this.exportButton.setAttribute('aria-label', this.exportLabel);
  }

  updateExportState() {
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

  get exportLabel() {
    const attr = this.getAttribute('export-label');
    return attr && attr.trim() ? attr.trim() : 'Export';
  }

  get exportEmptyLabel() {
    const attr = this.getAttribute('export-empty-label');
    return attr && attr.trim() ? attr.trim() : 'No data to export';
  }

  reflectLangAttribute(lang) {
    this.suppressAttributeSync = true;
    this.setAttribute('lang', lang);
    this.suppressAttributeSync = false;
  }

  persistLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      localStorage.setItem(FALLBACK_LOWER_KEY, lang.toLowerCase());
    } catch (err) {
      // Storage optional
    }
  }

  readStoredLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_LOWER_KEY) || '';
      return normaliseLang(stored);
    } catch (err) {
      return null;
    }
  }

  setHandler(eventName, handler, key) {
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
