# Summary Toolbar QA (Manual)

## Scope
Summary toolbar regression on Summary dashboard; comparison against Corporate baseline.

## Environment
- Local static build served via `python -m http.server 8000`
- Browser: Playwright Chromium (headless)
- Build: repository state at commit under test

## Checklist
1. **Language switcher & export** – EN · NL · RU with Export beneath observed on right end of first toolbar row. (Matches expected corporate layout.)
2. **Date range controls order** – Verified row order: Today, 7 Days, Month to date, Quarter to date, Year to date → Demo | Live → Team → Start → End → Compare.
3. **Visual parity** – Chip height, spacing, and headline typography match Corporate baseline (comparison screenshots attached below).
4. **Unique toolbar container** – DOM inspection confirms single `#toolbar` instance without duplicates.
5. **Console health** – No console warnings or font-loading errors observed during navigation.
6. **Mode toggle behavior** – Switching Demo/Live updates `?mode=` query parameter and re-renders content as expected.

## Artifacts
- Summary toolbar: `artifacts/summary-toolbar.png`
- Corporate toolbar reference: `artifacts/corporate-toolbar.png`

## Notes
- All DoD acceptance criteria satisfied.
- Static assets served without network errors; fonts loaded successfully.
