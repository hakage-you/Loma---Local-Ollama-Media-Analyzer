// モック版 @tauri-apps/api/event。バックエンドからのイベントは発生しないため no-op で解除関数を返すだけ。
export type UnlistenFn = () => void;

export async function listen<T>(
  event: string,
  _handler: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  console.info(`[mock event] listen("${event}") registered (no events will fire)`);
  return () => {};
}
