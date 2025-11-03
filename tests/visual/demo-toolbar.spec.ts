import path from 'node:path';
import { promises as fs } from 'node:fs';
import { test, expect } from '@playwright/test';

const BASELINE_DIR = path.resolve(__dirname, 'demo-toolbar.spec.ts-baseline');
const UPDATE_FLAG = 'UPDATE_VISUAL_BASELINES';

async function readBaseline(browserName: string) {
  const filename = `demo-toolbar-${browserName}.base64`;
  const filePath = path.join(BASELINE_DIR, filename);
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    return contents.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Missing baseline for ${browserName}. Run with ${UPDATE_FLAG}=1 to generate ${filename}.`,
      );
    }
    throw error;
  }
}

test.describe('Demo toolbar', () => {
  test('frozen UI', async ({ page, browserName }, testInfo) => {
    await page.goto('/Demo.html');
    const toolbar = page.getByTestId('demo-toolbar');
    const screenshot = await toolbar.screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      timeout: 20_000,
    });

    const base64Screenshot = screenshot.toString('base64');
    const baselinePath = path.join(BASELINE_DIR, `demo-toolbar-${browserName}.base64`);

    if (process.env[UPDATE_FLAG] === '1') {
      await fs.writeFile(baselinePath, `${base64Screenshot}\n`, 'utf8');
    }

    const baseline = await readBaseline(browserName);

    await testInfo.attach('demo-toolbar-actual.png', {
      body: screenshot,
      contentType: 'image/png',
    });

    await testInfo.attach('demo-toolbar-baseline.png', {
      body: Buffer.from(baseline, 'base64'),
      contentType: 'image/png',
    });

    expect(base64Screenshot).toBe(baseline);
  });
});
