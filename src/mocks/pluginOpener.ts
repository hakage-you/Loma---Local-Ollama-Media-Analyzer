// モック版 @tauri-apps/plugin-opener。外部URLへの実際の遷移はスクリーンショット作業を妨げるため行わない。
export async function openUrl(url: string): Promise<void> {
  console.info(`[mock opener] openUrl("${url}") — navigation suppressed in mock mode`);
}
