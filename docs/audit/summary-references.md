# Summary references audit

- `Summary.html` : L5 `<title>SPA2099 HR Health — Summary</title>`; L44 `<script type="module" src="./assets/js/render/summaryRender.js?v=2025.10.19-05"></script>`; L46 `<script defer src="./assets/js/summary.legend.js?v=2025.10.19-05"></script>`; L60 `<script type="module" src="assets/js/pages/summary.js?v=2025-11-02-2"></script>`.
- `assets/js/pages/summary.js` : L1–5 imports toolbar, mode store, data source, app state, and `renderSummary`; L15–71 template injects Summary layout (`#summary-root`, KPI/trend/at-risk sections, legend modal); L75–125 handles mode switching and initialization (`renderToolbar`, `window.renderSideNav('summary')`, `renderSummary()`).
- `assets/js/render/summaryRender.js` : L1–4 import app state + thresholds; L6–76 `renderSummary()` computes KPIs/trends/at-risk content for `#summary-root`; helpers L102–344 build summary cards, trend charts, and empty states.
- `assets/js/summary.js` : L39–152 legacy Summary bootstrap storing `window.SUMMARY`, binding scenario/range controls, loading samples, and exposing `SUMMARY.*` helpers.
- `assets/js/summary.legend.js` : L1–198 modal behavior for the Summary legend (wires `#legend-modal`, renders metric descriptions, handles focus trapping).
- `assets/css/aurora.css` : L4–14 comments/imports noting the bundle aggregates legacy styles for “summary/analytics views” and pulls in `summary.css`.
- `assets/css/summary.css` : L1–99 Summary-specific styles (KPI cards, trend blocks, at-risk table, legend modal, banners, empty state safeguards).
- `assets/js/nav.js` : L5 navigation item `{id:'summary', href:'Summary.html', i18n:'nav.summary'}`; active-page fallback defaults to `'summary'` on DOMContentLoaded (L69–75).
- `partials/sidebar.html` : L12 `<a href="./Summary.html" data-key="summary" data-i18n="nav.summary">Summary</a>` sidebar entry.
- `README.md` : L4 Overview references “leadership summary views”; L12 run instructions link to `http://localhost:8000/Summary.html`.
- `assets/js/services/dataSource.js` : L1–21 defines `loadSamples`/`loadDemoSamples()` fetching `/public/demo/night-shift.json` for Summary data.
- `assets/js/data-loader.js` : L15–34 scenario mapping includes `'night-shift'` alias for demo datasets consumed by Summary flows.
- `public/demo/night-shift.json` : L1–18 demo biometric samples (`stress`, `burnout`, `fatigue`, `wellbeing`) rendered on Summary dashboards.
- `assets/locales/en.json` : L3–140 contains Summary navigation labels, legend copy, status banners, and toast strings; L250, L320 reuse Summary terms in devices/toasts.
- `assets/locales/ru.json` : L3–140 Russian equivalents for Summary navigation, legend, banners, and error strings; L250, L320 localized reuse.
- `src/features/summary/SummaryPage.tsx` : L1–206 React Summary page assembling KPIs (`KpiRow`), trends, at-risk table, and demo data via `loadDemoSamples`.
- `src/features/summary/KpiRow.tsx` : L4–37 Summary KPI row component contract (`KpiSummaryCard`, `PLACEHOLDER_TEXT`).
- `assets/js/stores/modeStore.js` : L1–9 shared mode persistence used by Summary page toggles.
