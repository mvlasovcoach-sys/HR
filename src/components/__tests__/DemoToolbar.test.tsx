import { fireEvent } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/components/DemoToolbar';

describe('DemoToolbarElement', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders toolbar structure with ARIA hooks', () => {
    const element = document.createElement('demo-toolbar');
    document.body.appendChild(element);
    const html = element.shadowRoot?.innerHTML.replace(/\s+/g, ' ').trim();
    expect(html).toMatchInlineSnapshot(
      `"<style>:host { display: block; width: 100%; } header { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; min-height: 64px; padding: 16px 20px; border-radius: 18px; border: 1px solid rgba(43, 217, 178, 0.12); background: linear-gradient(135deg, rgba(8, 26, 33, 0.92), rgba(5, 18, 24, 0.88)); box-shadow: 0 18px 32px rgba(4, 18, 24, 0.45); backdrop-filter: blur(18px); color: #e6f3f7; } h1 { margin: 0; font: 700 clamp(22px, 2.6vw, 32px) / 1.2 \"Inter\", system-ui, sans-serif; letter-spacing: -0.01em; white-space: nowrap; min-width: 0; } .spacer { flex: 1; min-width: 12px; } nav { display: inline-flex; align-items: center; gap: 8px; flex-wrap: nowrap; } button { border: 1px solid rgba(29, 209, 180, 0.7); background: transparent; color: inherit; padding: 8px 16px; border-radius: 18px; font: 600 15px/1.2 \"Inter\", system-ui, sans-serif; letter-spacing: 0.02em; cursor: pointer; outline: none; transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease; } button:focus { outline: none; } button:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(7, 24, 31, 0.95), 0 0 0 4px rgba(29, 209, 180, 0.9); } button[aria-pressed=\"true\"] { background: rgba(29, 209, 180, 0.12); border-color: rgba(29, 209, 180, 0.95); } button:not([aria-pressed=\"true\"]):hover { transform: translateY(-1px); } button[disabled] { cursor: not-allowed; opacity: 0.6; transform: none; } .export { min-width: 116px; } @media (max-width: 720px) { header { flex-wrap: wrap; row-gap: 10px; padding: 14px 16px; } nav { order: 3; width: 100%; justify-content: flex-start; flex-wrap: wrap; row-gap: 8px; } .export { order: 2; } }</style><header class=\"wrap\" part=\"header\" role=\"region\" aria-label=\"Demo toolbar\" data-testid=\"demo-toolbar\"><h1 class=\"title\" part=\"title\">Demo</h1><div class=\"spacer\" aria-hidden=\"true\"></div><nav class=\"langs\" role=\"tablist\" aria-label=\"Language\" part=\"lang-group\"><button type=\"button\" class=\"btn\" part=\"lang-button\" data-lang=\"EN\" aria-pressed=\"false\">EN</button> <button type=\"button\" class=\"btn\" part=\"lang-button\" data-lang=\"NL\" aria-pressed=\"false\">NL</button> <button type=\"button\" class=\"btn\" part=\"lang-button\" data-lang=\"RU\" aria-pressed=\"false\">RU</button></nav><button type=\"button\" class=\"export\" part=\"export-button\" data-role=\"export\" aria-label=\"Export Demo data\">Export</button></header>"
    );
  });

  it('persists language selection and emits events', () => {
    const element = document.createElement('demo-toolbar');
    document.body.appendChild(element);
    const spy = vi.fn();
    element.addEventListener('demo:langChanged', spy as EventListener);
    const buttons = element.shadowRoot?.querySelectorAll('[data-lang]');
    expect(buttons?.length).toBe(3);
    fireEvent.click(buttons?.[1] as Element);
    expect(spy).toHaveBeenCalled();
    expect(localStorage.getItem('demo-lang')).toBe('NL');
  });

  it('emits export event when enabled', () => {
    const element = document.createElement('demo-toolbar');
    document.body.appendChild(element);
    element.removeAttribute('export-disabled');
    const exportSpy = vi.fn();
    element.addEventListener('demo:export', exportSpy as EventListener);
    const exportButton = element.shadowRoot?.querySelector('[data-role="export"]');
    fireEvent.click(exportButton as Element);
    expect(exportSpy).toHaveBeenCalledTimes(1);
  });
});
