import { test, expect } from '@playwright/test';
import path from 'node:path';

const catalogPath = path.resolve(__dirname, '../../docs/ui-catalog.html');
const catalogUrl = 'file://' + catalogPath;

test.describe('UI catalog', () => {
  test('core components render as expected', async ({ page }) => {
    await page.goto(catalogUrl);
    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(page.locator('[data-spec="card"]')).toHaveScreenshot('card.png', { maxDiffPixelRatio: 0.02 });
    await expect(page.locator('[data-spec="tabs"]')).toHaveScreenshot('tabs.png', { maxDiffPixelRatio: 0.02 });
    await expect(page.locator('[data-spec="kpi"]')).toHaveScreenshot('kpi.png', { maxDiffPixelRatio: 0.02 });
    await expect(page.locator('[data-spec="chart-card"]')).toHaveScreenshot('chart-card.png', { maxDiffPixelRatio: 0.02 });
    await expect(page.locator('[data-spec="sidebar"]')).toHaveScreenshot('sidebar.png', { maxDiffPixelRatio: 0.02 });
    await expect(page.locator('[data-spec="buttons"]')).toHaveScreenshot('buttons.png', { maxDiffPixelRatio: 0.02 });
  });
});
