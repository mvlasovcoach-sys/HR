# Brandbook Workflow

## Adding a New Component
1. Start by defining tokens in `shared/tokens.css` if new spacing, radii, or colors are required.
2. Add structural styles in `shared/components.css` or create a scoped stylesheet in `shared/`.
3. Showcase every state of the component inside `docs/ui-catalog.html` to keep visual coverage up to date.
4. Update or create Playwright screenshot tests under `tests/visual` so regressions fail the CI pipeline.
5. Run `npm run lint` and `npm run test` locally before opening a pull request.

## Requesting an Exception
Occasionally a flow might require deviating from the brand system (for example, to integrate a third-party widget).

1. Document the rationale, affected surfaces, and time-bound mitigation in your pull request.
2. Tag `@design-system` reviewers and attach screenshots or recordings.
3. Capture the exception in the pull request checklist so future contributors know about the temporary allowance.
4. Open a follow-up issue to track removal of the exception, including expected delivery date.
