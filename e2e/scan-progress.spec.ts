import { test, expect, Page } from '@playwright/test';

// 進捗パネル（解析速度・残り時間）の検証。
// `?debugScan=` はモックモードの進捗シミュレータ（src/mocks/scanSimulator.ts）を起動する。
//
// 残り時間は実時間から算出されるため、debugScanIntervalMs で指定した
// 1件あたりの疑似所要時間がそのまま「秒/件」に現れることを利用して検証する。

const ITEM_MS = 600;
const TOTAL = 838;

const speedBadge = (page: Page) => page.getByText(/秒\/件/);
const etaBadge = (page: Page) => page.getByText(/残り時間:/);

/** "1.5 秒/件" → 1.5 */
async function readSecPerItem(page: Page): Promise<number> {
  const text = (await speedBadge(page).innerText()).trim();
  const m = text.match(/([\d.]+)\s*秒\/件/);
  if (!m) throw new Error(`速度表示を解釈できなかった: ${text}`);
  return Number(m[1]);
}

/** "残り時間: 1日 2時間 3分" / "13分 18秒" → 秒 */
async function readEtaSeconds(page: Page): Promise<number> {
  const text = (await etaBadge(page).innerText()).trim();
  const d = Number(text.match(/(\d+)日/)?.[1] ?? 0);
  const h = Number(text.match(/(\d+)時間/)?.[1] ?? 0);
  const m = Number(text.match(/(\d+)分/)?.[1] ?? 0);
  const s = Number(text.match(/(\d+)秒/)?.[1] ?? 0);
  return d * 86400 + h * 3600 + m * 60 + s;
}

async function readProgressCurrent(page: Page): Promise<number> {
  const text = await page.getByText(/\d+ \/ \d+ \(\d+%\)/).innerText();
  return Number(text.match(/(\d+) \//)![1]);
}

test.describe('スキャン進捗パネル', () => {
  test('スキャン実行中に起動しても速度と残り時間が表示される', async ({ page }) => {
    // 起動時点で scanning=true かつ progress が未到着という、以前は永久に
    // 計測基準が設定されず何も表示されなかった状況を再現する
    await page.goto(`/?debugScan=mid&debugScanIntervalMs=${ITEM_MS}`);

    await expect(page.getByText('解析処理中')).toBeVisible();

    // 2件目のイベント到着後、実測値が出る
    await expect(speedBadge(page)).toBeVisible({ timeout: 15_000 });
    await expect(etaBadge(page)).not.toContainText('計測中');

    const secPerItem = await readSecPerItem(page);
    expect(secPerItem).toBeGreaterThan(ITEM_MS / 1000 * 0.5);
    expect(secPerItem).toBeLessThan(ITEM_MS / 1000 * 2.5);
  });

  test('1件目が完了するまでは「計測中」と表示する', async ({ page }) => {
    // 1件あたりを長くとり、1件目の解析中（＝まだ平均を出せない）状態を確実に捉える
    await page.goto('/?debugScan=mid&debugScanIntervalMs=6000');

    // 最初の進捗イベントでパネルが現れた直後は、まだ完了件数が 0
    await expect(page.getByText('解析処理中')).toBeVisible({ timeout: 20_000 });
    await expect(etaBadge(page)).toContainText('計測中');
    // 平均が出るまでは速度も「計算中...」で、秒/件 はまだ表示されない
    await expect(page.getByText('計算中...')).toBeVisible();
    await expect(speedBadge(page)).toHaveCount(0);
  });

  test('残り時間が「秒/件 × 残り件数」と整合する', async ({ page }) => {
    await page.goto(`/?debugScan=mid&debugScanIntervalMs=${ITEM_MS}`);
    await expect(speedBadge(page)).toBeVisible({ timeout: 15_000 });

    const secPerItem = await readSecPerItem(page);
    const current = await readProgressCurrent(page);
    const etaSec = await readEtaSeconds(page);

    // 解析中の1件も残りに含める
    const expected = secPerItem * (TOTAL - current + 1);
    // 表示は分/秒単位で丸められるため許容幅を持たせる
    expect(Math.abs(etaSec - expected)).toBeLessThan(Math.max(90, expected * 0.15));
  });

  test('登録フェーズの速度が解析フェーズの見積りに混入しない', async ({ page }) => {
    // 登録フェーズ（高速）→ 解析フェーズ（低速・current が 1 に巻き戻る）
    await page.goto(`/?debugScan=full&debugScanIntervalMs=${ITEM_MS}`);

    // 解析フェーズに入るまで待つ
    await expect(page.getByText(/Analyzing with Ollama/)).toBeVisible({ timeout: 30_000 });
    await expect(speedBadge(page)).toBeVisible({ timeout: 15_000 });

    // 解析フェーズで基準が取り直されていれば、登録フェーズの高速な値ではなく
    // 解析の実速度（ITEM_MS）が表示される
    await expect
      .poll(async () => readSecPerItem(page), { timeout: 15_000 })
      .toBeGreaterThan(ITEM_MS / 1000 * 0.5);

    const secPerItem = await readSecPerItem(page);
    expect(secPerItem).toBeLessThan(ITEM_MS / 1000 * 2.5);
  });

  test('進捗イベントが来ない間も残り時間が更新され続ける', async ({ page }) => {
    // 1件に時間がかかる状況では、イベント間隔中も表示が固まらないこと
    await page.goto(`/?debugScan=mid&debugScanIntervalMs=4000`);
    await expect(speedBadge(page)).toBeVisible({ timeout: 20_000 });

    const first = await readSecPerItem(page);
    // 同一件を解析している間も経過時間の反映で秒/件が増えていく
    await expect.poll(async () => readSecPerItem(page), { timeout: 6_000 }).toBeGreaterThan(first);
  });
});
