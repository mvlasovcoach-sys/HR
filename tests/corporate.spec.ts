import { test, expect } from '@playwright/test';

test('Corporate page shows KPI cards', async ({ page }) => {
  await page.goto('/HR/Corporate.html');
  await expect(page.getByRole('heading', { name: /Corporate/i })).toBeVisible();
  const kpiCount = await page.locator('.kpi-card').count();
  expect(kpiCount).toBeGreaterThan(0);
});

test('Heatmap exposes accessible cells', async ({ page }) => {
  await page.goto('/HR/Corporate.html');
  const grid = page.locator('[role="grid"]');
  await expect(grid).toBeVisible();
  const firstCell = grid.locator('[role="gridcell"]').first();
  await expect(firstCell).toHaveAttribute('aria-label', /Team/i);
});

test('Language switch updates aria-pressed state', async ({ page }) => {
  await page.goto('/HR/Corporate.html');
  const nlButton = page.getByRole('button', { name: 'NL' });
  await nlButton.click();
  await expect(nlButton).toHaveAttribute('aria-pressed', 'true');
});

test('Export loads capture libraries on first click', async ({ page }) => {
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

test('KPI ranges react to toolbar selections', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/HR/Corporate.html');

  const firstNumber = page.locator('.kpi-card').first().locator('.kpi-card__number');
  await expect(firstNumber).not.toHaveText('—', { timeout: 10000 });
  const initialValue = await firstNumber.textContent();

  await page.getByRole('button', { name: '7 Days' }).click();
  await page.waitForFunction(() => document.querySelector('.kpi-cards')?.classList.contains('is-loading') === true);
  await page.waitForFunction(() => document.querySelector('.kpi-cards')?.classList.contains('is-loading') === false);
  if (initialValue) {
    await expect(firstNumber).not.toHaveText(initialValue, { timeout: 10000 });
  }
  const sevenDayValue = await firstNumber.textContent();

  await page.getByRole('button', { name: /Month to date/i }).click();
  await page.waitForFunction(() => document.querySelector('.kpi-cards')?.classList.contains('is-loading') === true);
  await page.waitForFunction(() => document.querySelector('.kpi-cards')?.classList.contains('is-loading') === false);
  if (sevenDayValue) {
    await expect(firstNumber).not.toHaveText(sevenDayValue, { timeout: 10000 });
  }

  await page.getByRole('button', { name: 'Live' }).click();
  await page.waitForFunction(() => document.querySelector('.kpi-cards')?.classList.contains('is-loading') === true);
  await page.waitForFunction(() => document.querySelector('.kpi-cards')?.classList.contains('is-loading') === false);

  expect(consoleErrors).toEqual([]);
});
