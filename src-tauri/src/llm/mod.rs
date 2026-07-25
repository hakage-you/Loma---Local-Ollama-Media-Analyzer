pub mod traits;
pub mod ollama;
pub mod gemini;
pub mod openai;
pub mod claude;
pub mod retry;
pub mod factory;

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct TagPair {
    pub en: String,
    pub ja: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct AnalysisResult {
    pub categories: Vec<String>,
    pub tags: Vec<TagPair>,
}

/// LLMからの生のテキストレスポンスから JSON 部分を抽出して AnalysisResult にパースする堅牢なヘルパー関数
pub fn parse_analysis_result(raw_response: &str) -> anyhow::Result<AnalysisResult> {
    let clean = raw_response.trim();
    if clean.is_empty() {
        return Err(anyhow::anyhow!("Received empty response content from LLM. Please ensure the selected model supports image/multimodal analysis."));
    }
    
    // ```json ... ``` などのコードブロックのストリップ
    let json_str = if clean.contains("```") {
        let mut extracted = clean;
        for part in clean.split("```") {
            let p = part.trim();
            if let Some(rest) = p.strip_prefix("json") {
                extracted = rest.trim();
                break;
            } else if p.starts_with('{') {
                extracted = p;
                break;
            }
        }
        extracted
    } else {
        clean
    };

    // 最外層の '{' と '}' の抽出
    let start_idx = json_str.find('{').unwrap_or(0);
    let end_idx = json_str.rfind('}').map(|i| i + 1).unwrap_or_else(|| json_str.len());
    
    let trimmed_json = if start_idx < end_idx && end_idx <= json_str.len() {
        &json_str[start_idx..end_idx]
    } else {
        json_str
    };

    let result: AnalysisResult = serde_json::from_str(trimmed_json)
        .map_err(|e| anyhow::anyhow!("Failed to parse AnalysisResult JSON: {}. Content: {}", e, trimmed_json))?;

    Ok(result)
}

/// 高精度・大規模モデル（Gemini, Claude, GPT-4o, llava-34b等）向けの詳細プロンプト定義
pub const VLM_ANALYSIS_PROMPT_DETAILED: &str = r#"You are an expert media archivist. Perform an extremely accurate visual analysis of the provided image and generate metadata.

# Rules for "categories"
- Pick 1 to 3 matching items STRICTLY from the following list:
  ["screenshot", "document", "landscape", "food", "character", "animal", "person", "item_product", "art_illustration", "text_heavy", "tech", "other"]

# Rules for "tags"
- Output 5 to 10 accurate, reusable tags.
- Tag Naming & Granularity:
  - Proper Nouns: Always KEEP specific proper nouns intact (e.g., character names, brand/product names, title names, specific location names like "tokyo").
  - General Objects: For general items, prefer basic-level nouns over compound tags with materials or modifiers (e.g., use "counter" instead of "wooden_counter", or separate them into ["counter", "wood"]).
  - Avoid Ultra-Abstract Terms: DO NOT use over-abstract or generic words like: ["matter", "substance", "object", "thing", "element", "stuff", "entity", "image", "photo", "picture", "background", "file", "media"].
- Focus on: Main subjects, specific objects, proper nouns, text OCR keywords, visual style, and location.
- Each tag MUST be an object containing "en" (singular lowercase English) and "ja" (accurate and natural Japanese translation).

# Output Format
Respond ONLY with a valid JSON object matching this exact structure:
{
  "categories": ["animal", "landscape"],
  "tags": [
    {
      "en": "cat",
      "ja": "猫"
    },
    {
      "en": "cherry_blossom",
      "ja": "桜"
    }
  ]
}"#;

/// 軽量・小型モデル（qwen3-vl:4b等）向けの高速・安定化プロンプト定義
pub const VLM_ANALYSIS_PROMPT_LIGHT: &str = r#"Analyze this image and return metadata in JSON matching structure:
{"categories": ["animal"], "tags": [{"en": "cat", "ja": "猫"}]}

Categories options: ["screenshot", "document", "landscape", "food", "character", "animal", "person", "item_product", "art_illustration", "text_heavy", "tech", "other"]"#;

/// デフォルトプロンプト（互換性のためのフォールバック）
#[allow(dead_code)]
pub const VLM_ANALYSIS_PROMPT: &str = VLM_ANALYSIS_PROMPT_LIGHT;

/// モデル名からパラメータ数（~B）を数値 (f32) として抽出する堅牢なパース関数
/// 例: "qwen3-vl:4b" -> Some(4.0)
/// 例: "llama3.2-vision:11b" -> Some(11.0)
/// 例: "my-custom-model:12b" -> Some(12.0)
/// 例: "llava:34b" -> Some(34.0)
pub fn parse_model_parameter_size(model_name: &str) -> Option<f32> {
    let lower = model_name.to_lowercase();
    let bytes = lower.as_bytes();
    
    for (i, &b) in bytes.iter().enumerate() {
        if b == b'b' {
            let mut start = i;
            while start > 0 {
                let prev = bytes[start - 1];
                if prev.is_ascii_digit() || prev == b'.' {
                    start -= 1;
                } else {
                    break;
                }
            }
            if start < i {
                if let Ok(val) = lower[start..i].parse::<f32>() {
                    if val > 0.0 && val < 500.0 {
                        return Some(val);
                    }
                }
            }
        }
    }
    None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VlmPromptType {
    Detailed,
    Light,
}

impl VlmPromptType {
    pub fn name(&self) -> &'static str {
        match self {
            VlmPromptType::Detailed => "DETAILED (High-Precision)",
            VlmPromptType::Light => "LIGHT (Fast/Stable)",
        }
    }
}

/// プロバイダー名とモデル名に応じたプロンプトタイプとプロンプト本文を返す関数
pub fn get_vlm_prompt_info(provider_name: &str, model_name: &str) -> (VlmPromptType, &'static str) {
    let provider_lower = provider_name.to_lowercase();
    let model_lower = model_name.to_lowercase();

    // 1. クラウドプロバイダー (Gemini, OpenAI, Claude) は常に高精度詳細プロンプトを使用
    if provider_lower.contains("gemini")
        || provider_lower.contains("google")
        || provider_lower.contains("openai")
        || provider_lower.contains("gpt")
        || provider_lower.contains("claude")
        || provider_lower.contains("anthropic")
    {
        return (VlmPromptType::Detailed, VLM_ANALYSIS_PROMPT_DETAILED);
    }

    // 2. Ollamaモデルの数値パラメータ解析: 10B（100億パラメータ）以上は高精度詳細プロンプト
    if let Some(param_size) = parse_model_parameter_size(model_name) {
        if param_size >= 10.0 {
            return (VlmPromptType::Detailed, VLM_ANALYSIS_PROMPT_DETAILED);
        } else {
            return (VlmPromptType::Light, VLM_ANALYSIS_PROMPT_LIGHT);
        }
    }

    // 3. パース失敗時のキーワードフォールバック（例: 4b/11b などの数字がモデル名に含まれない場合）
    if model_lower.contains("large") || model_lower.contains("giant") || model_lower.contains("pro") {
        (VlmPromptType::Detailed, VLM_ANALYSIS_PROMPT_DETAILED)
    } else {
        // パラメータ数不明のモデルは、破綻を防ぎ安定動作させるため LIGHT に安全フォールバック
        (VlmPromptType::Light, VLM_ANALYSIS_PROMPT_LIGHT)
    }
}

/// プロンプト本文のみを返す便利関数
pub fn get_vlm_prompt(provider_name: &str, model_name: &str) -> &'static str {
    get_vlm_prompt_info(provider_name, model_name).1
}
