import { test, expect } from '@playwright/test';

async function freezeTime(page, isoTimestamp: string) {
  const ts = Date.parse(isoTimestamp);
  await page.addInitScript((timestamp) => {
    const OriginalDate = Date;
    class MockDate extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          return new OriginalDate(timestamp);
        }
        return new OriginalDate(...args);
      }
      static now() {
        return timestamp;
      }
      static UTC(...args: any[]) {
        return OriginalDate.UTC(...args);
      }
      static parse(value: string) {
        return OriginalDate.parse(value);
      }
    }
    (window as any).Date = MockDate;
  }, ts);
}

async function mountDemo(page, iso: string) {
  await freezeTime(page, iso);
  await page.goto('/Corporate.html?mode=demo', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#onDutyBadge');
}

test.describe('On duty badge (demo)', () => {
  test('shows expected totals during day shift', async ({ page }) => {
    await mountDemo(page, '2024-01-01T09:00:00Z');
    const badge = page.locator('#onDutyBadge');
    await expect(badge).toContainText('On duty: 57 • Sample: 43 (75%)');
  });

  test('shows expected totals during night shift', async ({ page }) => {
    await mountDemo(page, '2024-01-01T21:00:00Z');
    const badge = page.locator('#onDutyBadge');
    await expect(badge).toContainText('On duty: 22 • Sample: 17 (75%)');
  });
});
