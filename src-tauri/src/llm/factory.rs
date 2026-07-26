use std::sync::Arc;
use anyhow::Result;
use sqlx::{Pool, Sqlite};

use crate::credentials::get_api_key;
use super::traits::LlmProvider;
use super::ollama::OllamaProvider;
use super::gemini::GeminiProvider;
use super::openai::OpenAiProvider;
use super::claude::ClaudeProvider;
use super::retry::RetryingLlmProvider;
use super::{PromptConfig, TagGranularity};

pub struct LlmFactoryConfig {
    pub provider: String,
    pub max_batch_items: u32,
}

/// settings テーブルと Windows Credentials から情報を読み込んで適切な LlmProvider インスタンスを生成する
pub async fn create_llm_provider(pool: &Pool<Sqlite>) -> Result<(Arc<dyn LlmProvider>, LlmFactoryConfig)> {
    create_llm_provider_with_prompt_override(pool, None).await
}

/// prompt_override が Some の場合、settings の tag_granularity / force_detailed_prompt を無視して
/// 指定された PromptConfig を使用する（粒度レベル比較コマンド用）
pub async fn create_llm_provider_with_prompt_override(
    pool: &Pool<Sqlite>,
    prompt_override: Option<PromptConfig>,
) -> Result<(Arc<dyn LlmProvider>, LlmFactoryConfig)> {
    let provider_name: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'llm_provider'")
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "ollama".to_string());

    let ext_max_items_str: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'ext_llm_max_batch_items'")
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "50".to_string());
    let max_batch_items: u32 = ext_max_items_str.parse().unwrap_or(50);

    let retry_enabled_str: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'ext_llm_retry_enabled'")
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "true".to_string());
    let retry_enabled = retry_enabled_str == "true";

    let retry_attempts_str: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'ext_llm_retry_max_attempts'")
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "3".to_string());
    let retry_max_attempts: u32 = retry_attempts_str.parse().unwrap_or(3);

    let retry_delay_str: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'ext_llm_retry_delay_sec'")
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "2".to_string());
    let retry_delay_sec: u64 = retry_delay_str.parse().unwrap_or(2);

    let prompt_config = match prompt_override {
        Some(cfg) => cfg,
        None => {
            let granularity_str: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'tag_granularity'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "atomic".to_string());
            let force_detailed_str: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'force_detailed_prompt'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "false".to_string());
            PromptConfig {
                granularity: TagGranularity::from_setting(&granularity_str),
                force_detailed: force_detailed_str == "true",
            }
        }
    };

    let base_provider: Arc<dyn LlmProvider> = match provider_name.to_lowercase().as_str() {
        "gemini" => {
            let api_key = get_api_key("gemini")?;
            let model: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'gemini_model'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "gemini-2.0-flash".to_string());
            Arc::new(GeminiProvider::new(api_key, model, prompt_config))
        }
        "openai" => {
            let api_key = get_api_key("openai")?;
            let base_url: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'openai_base_url'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            let model: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'openai_model'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "gpt-4o-mini".to_string());
            Arc::new(OpenAiProvider::new(api_key, base_url, model, prompt_config))
        }
        "claude" => {
            let api_key = get_api_key("claude")?;
            let model: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'claude_model'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string());
            Arc::new(ClaudeProvider::new(api_key, model, prompt_config))
        }
        _ => {
            // デフォルト: Ollama
            let url: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'ollama_url'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "http://localhost:11434".to_string());
            let model: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'ollama_model'")
                .fetch_optional(pool)
                .await?
                .unwrap_or_else(|| "llava".to_string());
            Arc::new(OllamaProvider::new(url, model, prompt_config))
        }
    };

    // リトライが有効な場合は RetryingLlmProvider デコレーターで包む (Ollama・外部LLM共通)
    let final_provider: Arc<dyn LlmProvider> = if retry_enabled {
        Arc::new(RetryingLlmProvider::new(base_provider, retry_max_attempts, retry_delay_sec))
    } else {
        base_provider
    };

    let (prompt_style, _) = super::get_vlm_prompt_info(final_provider.name(), final_provider.model_name(), &prompt_config);
    crate::logger::log_info(&format!("[LLM Provider] Initialized '{}' (model: '{}') using prompt style: {}", final_provider.name(), final_provider.model_name(), prompt_style.name()));

    let config = LlmFactoryConfig {
        provider: provider_name,
        max_batch_items,
    };

    Ok((final_provider, config))
}
