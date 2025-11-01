function resolveBasePath() {
  if (typeof window === 'undefined') {
    return '';
  }

  const loaderGlobals = window.loaderGlobals || {};

  const normalise = value => {
    if (!value) return '';
    const str = String(value).trim();
    if (!str) return '';

    const attemptUrlNormalise = (input, allowUrl = true) => {
      if (!input) return '';
      const text = String(input).trim();
      if (!text) return '';

      if (allowUrl) {
        try {
          const base = window.location?.href || document.baseURI || undefined;
          const url = new URL(text, base);
          return attemptUrlNormalise(url.pathname, false);
        } catch (err) {
          /* noop */
        }
      }

      if (text === '/' || text === '.' || text === './') {
        return '';
      }

      const withoutQuery = text.split(/[?#]/)[0];
      const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
      const trimmed = withLeadingSlash.replace(/\/+$/, '');
      return trimmed === '/' ? '' : trimmed;
    };

    return attemptUrlNormalise(str);
  };

  const fromLoaderGlobals = (() => {
    if (typeof loaderGlobals.BASE === 'string') return loaderGlobals.BASE;
    if (typeof loaderGlobals.base === 'string') return loaderGlobals.base;
    if (typeof loaderGlobals.base === 'function') {
      try {
        return loaderGlobals.base();
      } catch (err) {
        return null;
      }
    }
    return null;
  })();

  const fromLoader = normalise(fromLoaderGlobals);
  if (fromLoader) {
    return fromLoader;
  }

  if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    const baseEl = document.querySelector('base[href]');
    const baseHref = baseEl?.getAttribute('href') || baseEl?.href;
    const fromBase = normalise(baseHref);
    if (fromBase) {
      return fromBase;
    }
  }

  const pathname = window.location?.pathname;
  if (typeof pathname === 'string') {
    const directory = pathname.replace(/[^/]*$/, '') || '/';
    return normalise(directory);
  }

  return '';
}

export async function loadDemoSamples() {
  const base = resolveBasePath();
  const url = `${base}/public/demo/night-shift.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load demo dataset (${res.status})`);
  }
  return res.json();
}

export async function loadLiveSamples() {
  return [];
}
