(function(g){
  const registry = Object.create(null);

  function defineSource(entry){
    if (!entry || typeof entry !== 'object' || !entry.id) return;
    const key = String(entry.id);
    registry[key] = Object.freeze(Object.assign({}, entry, { id: key }));
  }

  function get(id){
    if (!id) return null;
    const key = String(id);
    return registry[key] || null;
  }

  function localize(value, lang){
    if (!value) return '';
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value[lang] || value.en || value.default || value['en-US'] || value['en-GB'] || '';
    }
    return typeof value === 'string' ? value : String(value);
  }

  function describe(id, lang){
    const source = get(id);
    if (!source) return null;
    const locale = (lang || g.I18N?.getLang?.() || g.document?.documentElement?.lang || 'en').slice(0, 2).toLowerCase();
    const methodology = source.methodology || {};
    const sample = source.sample || {};
    const nTotal = sample.nTotal != null ? Number(sample.nTotal) : undefined;
    return {
      id: source.id,
      title: localize(source.title, locale) || source.id,
      publisher: localize(source.publisher, locale),
      coverage: localize(source.coverage, locale),
      periodDefault: localize(source.periodDefault, locale),
      methodology: {
        threshold: methodology.threshold || '',
        stats: Array.isArray(methodology.stats) ? methodology.stats.slice() : []
      },
      sample: {
        unit: localize(sample.unit, locale),
        nTotal: Number.isFinite(nTotal) ? nTotal : undefined
      },
      updatedAt: source.updatedAt || '',
      link: source.link || '',
      isDemo: !!source.isDemo,
      disclaimer: localize(source.disclaimer, locale)
    };
  }

  function register(entry){
    defineSource(entry);
  }

  function formatStatEntry(text){
    const value = typeof text === 'string' ? text.trim() : '';
    if (!value) return '';
    if (/wilson/i.test(value) && /proportion/i.test(value)) {
      const cleaned = value.replace(/\s*for proportions\s*/i, '').trim();
      if (cleaned && !/^proportions\b/i.test(cleaned)) {
        return `Proportions with ${cleaned}`;
      }
    }
    if (/two-?proportion/i.test(value) && /z-?test/i.test(value) && !/^significance\b/i.test(value)) {
      return `Significance by ${value}`;
    }
    return value;
  }

  function formatStats(stats){
    const items = Array.isArray(stats) ? stats.map(formatStatEntry).filter(Boolean) : [];
    return items.join('; ');
  }

  defineSource({
    id: 'demo-synth-2025',
    title: {
      en: 'Demo synthetic dataset',
      nl: 'Demo synthetische dataset',
      ru: 'Демо-набор (синтетический)'
    },
    publisher: {
      en: 'Product demo (not real data)',
      nl: 'Productdemo (geen echte data)',
      ru: 'Демонстрационные данные (не реальные)'
    },
    methodology: {
      threshold: 'Wellness Score ≥ 60',
      stats: [
        '95% Wilson CI for proportions',
        'Two-proportion z-test vs overall (two-tailed)'
      ]
    },
    sample: {
      unit: {
        en: 'employees',
        nl: 'medewerkers',
        ru: 'сотрудники'
      },
      nTotal: 100
    },
    periodDefault: {
      en: '7 Days',
      nl: '7 dagen',
      ru: '7 дней'
    },
    coverage: {
      en: 'All demo departments',
      nl: 'Alle demo-afdelingen',
      ru: 'Все отделы демо'
    },
    updatedAt: '2025-10-19',
    link: '',
    isDemo: true,
    disclaimer: {
      en: 'Aggregated only; no raw biosignals; static thresholds; no ML',
      nl: 'Alleen aggregaten; geen ruwe biosignalen; statische drempels; geen ML',
      ru: 'Только агрегаты; без сырых биосигналов; статические пороги; без ML'
    }
  });

  defineSource({
    id: 'org-abc-2024q3',
    title: {
      en: 'Org ABC Wellbeing Q3-2024'
    },
    publisher: {
      en: 'Org ABC Occupational Health'
    },
    methodology: {
      threshold: 'Wellness Score ≥ 60',
      stats: ['95% Wilson CI', 'Two-proportion z-test']
    },
    sample: {
      unit: 'employees'
    },
    periodDefault: {
      en: 'Q3 2024'
    },
    coverage: {
      en: 'All departments'
    },
    updatedAt: '2024-10-01',
    link: 'https://example.org/methodology.pdf',
    isDemo: false
  });

  const api = Object.assign({}, g.Sources, {
    get,
    describe,
    register,
    list(){
      return Object.values(registry).map(item => Object.assign({}, item));
    },
    formatStats,
    localize
  });

  g.Sources = api;
})(window);
