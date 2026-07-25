use std::fs;
use std::path::{Path, PathBuf};
use async_trait::async_trait;
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::traits::LlmProvider;
use super::{get_vlm_prompt, parse_analysis_result, AnalysisResult};

#[derive(Serialize)]
struct OllamaGenerateOptions {
    temperature: f32,
    num_ctx: usize,
}

#[derive(Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    images: Vec<String>,
    stream: bool,
    options: OllamaGenerateOptions,
}

#[derive(Deserialize)]
struct OllamaGenerateResponse {
    response: String,
}

pub struct OllamaProvider {
    client: Client,
    base_url: String,
    model_name: String,
}

impl OllamaProvider {
    pub fn new(base_url: String, model_name: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            model_name,
        }
    }

    fn prepare_base64_image(image_path: &Path) -> Result<String> {
        match image::open(image_path) {
            Ok(img) => {
                let rgb_img = img.to_rgb8();
                let mut buffer = std::io::Cursor::new(Vec::new());
                if rgb_img.write_to(&mut buffer, image::ImageFormat::Jpeg).is_ok() {
                    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, buffer.into_inner()))
                } else {
                    let img_bytes = fs::read(image_path)?;
                    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, img_bytes))
                }
            }
            Err(_) => {
                let img_bytes = fs::read(image_path)?;
                Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, img_bytes))
            }
        }
    }
}

#[async_trait]
impl LlmProvider for OllamaProvider {
    fn name(&self) -> &str {
        "Ollama"
    }

    fn model_name(&self) -> &str {
        &self.model_name
    }

    async fn analyze_image(&self, image_path: &Path) -> Result<AnalysisResult> {

        let base64_img = Self::prepare_base64_image(image_path)?;
        
        let prompt = get_vlm_prompt("Ollama", &self.model_name);
        let req_body = OllamaGenerateRequest {
            model: self.model_name.clone(),
            prompt: prompt.to_string(),
            images: vec![base64_img],
            stream: false,
            options: OllamaGenerateOptions {
                temperature: 0.2,
                num_ctx: 8192,
            },
        };

        let endpoint = format!("{}/api/generate", self.base_url.trim_end_matches('/'));
        let res = self.client
            .post(&endpoint)
            .json(&req_body)
            .send()
            .await?;

        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Ollama API Error: {}", err_text));
        }

        let gen_res: OllamaGenerateResponse = res.json().await?;
        if gen_res.response.trim().is_empty() {
            return Err(anyhow!(
                "Ollama returned an empty response. Make sure the selected model ('{}') supports vision input (e.g., llava, llama3.2-vision).",
                self.model_name
            ));
        }
        parse_analysis_result(&gen_res.response)
    }

    async fn analyze_multi_frame(&self, frame_paths: &[PathBuf]) -> Result<AnalysisResult> {
        let mut base64_images = Vec::new();
        for path in frame_paths {
            if path.exists() {
                if let Ok(b64) = Self::prepare_base64_image(path) {
                    base64_images.push(b64);
                }
            }
        }

        if base64_images.is_empty() {
            return Err(anyhow!("No valid frames found for analysis"));
        }

        let prompt = get_vlm_prompt("Ollama", &self.model_name);
        let multi_prompt = format!(
            "{}\n\nNote: Multiple sequential video frames (3 frames: pre, main, post) are provided above. Synthesize them to generate accurate tags and categories.",
            prompt
        );

        let req_body = OllamaGenerateRequest {
            model: self.model_name.clone(),
            prompt: multi_prompt,
            images: base64_images,
            stream: false,
            options: OllamaGenerateOptions {
                temperature: 0.2,
                num_ctx: 8192,
            },
        };

        let endpoint = format!("{}/api/generate", self.base_url.trim_end_matches('/'));
        let res = self.client
            .post(&endpoint)
            .json(&req_body)
            .send()
            .await?;

        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Ollama API Multi-frame Error: {}", err_text));
        }

        let gen_res: OllamaGenerateResponse = res.json().await?;
        if gen_res.response.trim().is_empty() {
            return Err(anyhow!(
                "Ollama returned an empty response. Make sure the selected model ('{}') supports vision input (e.g., llava, llama3.2-vision).",
                self.model_name
            ));
        }
        parse_analysis_result(&gen_res.response)
    }

    async fn check_health(&self) -> Result<()> {
        let endpoint = format!("{}/api/tags", self.base_url.trim_end_matches('/'));
        let res = self.client.get(&endpoint).send().await?;
        if res.status().is_success() {
            Ok(())
        } else {
            Err(anyhow!("Ollama server health check failed with status: {}", res.status()))
        }
    }
}
