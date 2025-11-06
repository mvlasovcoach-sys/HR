import { test, expect } from '@playwright/test';

test('Corporate renders KPI & heatmap', async ({ page }) => {
  await page.goto('/HR/Corporate.html');
  await expect(page.getByRole('heading', { name: /Corporate/i })).toBeVisible();

  const kpiCount = await page.locator('.kpi-card').count();
  expect(kpiCount).toBeGreaterThan(0);

  const grid = page.locator('[role="grid"]');
  await expect(grid).toBeVisible();
  const firstCell = grid.locator('[role="gridcell"]').first();
  await expect(firstCell).toHaveAttribute('aria-label', /Team/i);
});

test('Language switch works', async ({ page }) => {
  await page.goto('/HR/Corporate.html');
  const nlButton = page.getByRole('button', { name: 'NL' });
  await nlButton.click();
  await expect(nlButton).toHaveAttribute('aria-pressed', 'true');
});

test('Export lazy-loads libraries', async ({ page }) => {
  await page.goto('/HR/Corporate.html');
  const exportBtn = page.getByRole('button', { name: /Export/i });
  const [download] = await Promise.all([
    page.waitForEvent('download').catch(() => null),
    exportBtn.click()
  ]);
  if (!download) {
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.html2canvas || window.jspdf);
});
