# SPA2099 HR Health Dashboard

## Overview
Static prototype for the SPA2099 HR Health experience, including leadership summary views and a live wellness dashboard backed by a mock biometric stream.

## Running locally
1. Ensure you have Python 3 installed.
2. From the project root, start a local server:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000/Summary.html` (or `User.html`) in your browser.

The mock stream and dashboards will load automatically once served from a local web server.

## Corporate overview demo

The Corporate leadership experience reuses the shared UI token + component system introduced for Wellness.

* Visit [`Corporate.html`](http://localhost:8000/Corporate.html) after starting the server to see the aggregates-only view with KPI tiles, heatmap, detected events, and activity log panels.
* Use the header range controls to flip between the `7d`, `Month`, and `Year` aggregate bundles. The page reacts to `localStorage` updates made anywhere else in the experience via the `hr:range` key.
* Click **Load Night-Shift Scenario** to swap in the prepared `data/scenario/night_shift` data set. Click again (or refresh) to return to the live aggregates.
* Export buttons and filters operate entirely on the aggregate JSON bundles—no personal data or biosignal payloads are ever loaded.

All Corporate UI panels share the same tokens (colors, radii, shadows, typography) as the Wellness dashboards to guarantee consistency.
