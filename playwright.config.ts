import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/visual',
  snapshotDir: 'tests/visual/__screenshots__',
  fullyParallel: false,
  use: {
    viewport: { width: 1280, height: 720 }
  }
});
