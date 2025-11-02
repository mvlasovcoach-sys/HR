const host = typeof location === 'object' && location ? location.host : '';
export const __DEV__ = !/github\.io$/i.test(host);

export function devError(...args) {
  if (!__DEV__) return;
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(...args);
  }
}

export function devWarn(...args) {
  if (!__DEV__) return;
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(...args);
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__DEV__ = __DEV__;
  globalThis.devError = devError;
  globalThis.devWarn = devWarn;
}
