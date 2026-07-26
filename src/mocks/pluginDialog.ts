// モック版 @tauri-apps/plugin-dialog。OSネイティブダイアログはブラウザで開けないため、
// 常にキャンセル相当(null)を返す。「フォルダ追加」ボタン自体の見た目確認が目的。
export async function open(_options?: unknown): Promise<string | string[] | null> {
  console.info('[mock dialog] open() called — native dialog is unavailable in mock mode');
  return null;
}
