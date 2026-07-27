# E2E (Playwright)

Tauri のネイティブウィンドウはブラウザ自動操作で扱えないため、
`vite --mode mock`（バックエンドをモックへ差し替えたブラウザ版）を対象に UI を検証する。

```bash
npm run test:e2e          # ヘッドレス実行
npm run test:e2e:headed   # ブラウザを表示して実行
npm run test:e2e:ui       # Playwright UI モードで対話的に実行
npx playwright show-report
```

dev サーバーは Playwright が自動起動する（専用ポート **5199** 固定なので、
開発中の `npm run dev` (5173) と衝突しない）。

初回のみブラウザの取得が必要:

```bash
npx playwright install chromium
```

## モックモードのデバッグ用フック

コンポーネント本体には手を入れず、URL パラメータで状態を再現する。

| パラメータ | 内容 |
| --- | --- |
| `?debugOpen=settings` | 設定モーダルを開いた状態で起動 |
| `?debugOpen=search` | 詳細検索モーダルを開いた状態で起動 |
| `?debugScan=mid` | **スキャン実行中にアプリを起動**した状況（起動時 `progress` が未到着） |
| `?debugScan=full` | 登録フェーズ → 解析フェーズ（`current` が 1 に巻き戻る） |
| `?debugScanIntervalMs=600` | 1件あたりの疑似所要時間（既定 1500ms） |

進捗イベントの疑似発火は [`src/mocks/scanSimulator.ts`](../src/mocks/scanSimulator.ts) が担う。
`vite.config.ts` のエイリアスは `mode === "mock"` 限定のため、本番ビルドには一切含まれない。

## 検証内容

- `scan-progress.spec.ts` — 解析速度と残り時間の算出。
  - 実時間から算出される仕様を利用し、`debugScanIntervalMs` の値が
    そのまま「秒/件」に現れることで正しさを確認する。
  - 登録フェーズ（高速）の速度が解析フェーズ（低速）の見積りへ混入しないこと。
- `settings.spec.ts` — 設定モーダルの構成。
  - 基本表示は言語・タグ粒度・モデル選択のみで、他は「詳細設定」に格納されていること。
  - コンテキスト長と最大長辺が縦に並んでいること（座標で検証）。
  - 保存した値がモーダルを開き直しても保持されること。

## 注意

設定モーダルは閉じても内部状態を保持する（`open` は prop で、コンポーネントは常時マウント）。
そのため「詳細設定」の開閉状態はモーダルを開き直しても引き継がれる。
テスト側は `ensureAdvancedOpen()` で冪等に開く。
