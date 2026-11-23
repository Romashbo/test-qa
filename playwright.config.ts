import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Два режима запуска:
 *  1. По умолчанию — Playwright сам поднимает магазин из ./app на чистых данных
 *     (временный DATA_DIR + ALLOW_TEST_RESET=1). Полностью воспроизводимо, подходит для CI.
 *  2. BASE_URL=https://... — тесты идут против уже развёрнутого стенда, ничего не сбрасывая.
 */
// Пустая строка (так приходит незаполненный input в GitHub Actions) = локальный режим.
const EXTERNAL_BASE_URL = process.env.BASE_URL?.trim().replace(/\/$/, '') || undefined;
const PORT = Number(process.env.APP_PORT || 3100);
const LOCAL_BASE_URL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

// Конфиг выполняется и в воркерах — каталог создаём один раз и пробрасываем через env.
process.env.QA_SHOP_DATA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'qa-shop-data-'));

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalSetup: './tests/global-setup.ts',
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: EXTERNAL_BASE_URL ?? LOCAL_BASE_URL,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Смоук основных сценариев на мобильном вьюпорте.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@smoke/ },
  ],

  webServer: EXTERNAL_BASE_URL
    ? undefined
    : {
        command: 'node app/server.js',
        url: `${LOCAL_BASE_URL}/api/health`,
        reuseExistingServer: !isCI,
        timeout: 30_000,
        stdout: 'ignore',
        stderr: 'pipe',
        env: {
          PORT: String(PORT),
          DATA_DIR: process.env.QA_SHOP_DATA_DIR,
          ALLOW_TEST_RESET: '1',
        },
      },
});
