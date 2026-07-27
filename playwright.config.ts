import { defineConfig, devices } from '@playwright/test';

// UI検証用の E2E 設定。
// Tauri のネイティブウィンドウはブラウザ自動操作で扱えないため、
// `vite --mode mock`（バックエンドをモックに差し替えたブラウザ版）を対象にする。
//
//   npm run test:e2e          ヘッドレス実行
//   npm run test:e2e:headed   ブラウザを表示して実行
//   npm run test:e2e:ui       Playwright UI モードで対話的に実行
//
// 開発中の dev サーバー(5173)と衝突しないよう専用ポートを固定する。
const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
    },
  ],

  webServer: {
    command: `npm run dev:mock -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
