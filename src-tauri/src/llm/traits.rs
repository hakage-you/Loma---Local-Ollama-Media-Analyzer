use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use async_trait::async_trait;
use anyhow::Result;
use tauri::AppHandle;
use super::AnalysisResult;

#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// プロバイダー名（例: "Ollama", "Google Gemini", "OpenAI", "Anthropic Claude"）
    fn name(&self) -> &str;

    /// 現在使用中のモデル名
    fn model_name(&self) -> &str;

    /// 進捗表示用のステータスメッセージを生成する責務
    fn status_message(&self, is_first: bool) -> String {
        if self.name().eq_ignore_ascii_case("ollama") {
            if is_first {
                format!("Loading Model '{}' into VRAM...", self.model_name())
            } else {
                format!("Analyzing with Ollama ({})", self.model_name())
            }
        } else {
            format!("Analyzing with {} ({})", self.name(), self.model_name())
        }
    }

    /// バッチスキャン進行中のコンテキスト（AppHandle, キャンセルフラグ、件数）を保持・通知する
    fn update_progress_context(
        &self,
        _app_handle: &AppHandle,
        _cancel_flag: &Arc<AtomicBool>,
        _total: usize,
        _current: usize,
        _current_file: &str,
        _error_count: usize,
    ) {}

    /// 単一画像ファイルを VLM 解析する
    async fn analyze_image(&self, image_path: &Path) -> Result<AnalysisResult>;

    /// 複数フレーム（動画用マルチフレーム）を VLM 解析する
    #[allow(dead_code)]
    async fn analyze_multi_frame(&self, frame_paths: &[PathBuf]) -> Result<AnalysisResult>;

    /// プロバイダーへのヘルスチェック・接続確認を行う
    #[allow(dead_code)]
    async fn check_health(&self) -> Result<()>;
}
