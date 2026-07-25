use anyhow::{anyhow, Result};
use keyring::Entry;

const SERVICE_NAME: &str = "loma_app";

/// 指定プロバイダーの API Key を OS の安全な資格情報マネージャー（Windows Credential Store）に保存する
pub fn set_api_key(provider: &str, api_key: &str) -> Result<()> {
    let key_name = format!("{}_api_key", provider.to_lowercase());
    let entry = Entry::new(SERVICE_NAME, &key_name)
        .map_err(|e| anyhow!("Failed to access credential store: {}", e))?;
    
    if api_key.trim().is_empty() {
        // 空文字が渡された場合は認証情報を削除する
        let _ = entry.delete_password();
    } else {
        entry.set_password(api_key)
            .map_err(|e| anyhow!("Failed to save API key to secure store: {}", e))?;
    }
    Ok(())
}

/// OS の安全な資格情報マネージャーから指定プロバイダーの API Key を取得する
pub fn get_api_key(provider: &str) -> Result<String> {
    let key_name = format!("{}_api_key", provider.to_lowercase());
    let entry = Entry::new(SERVICE_NAME, &key_name)
        .map_err(|e| anyhow!("Failed to access credential store: {}", e))?;
    
    match entry.get_password() {
        Ok(pass) => Ok(pass),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(anyhow!("Failed to retrieve API key from secure store: {}", e)),
    }
}

/// 指定プロバイダーの API Key を資格情報マネージャーから削除する
#[allow(dead_code)]
pub fn delete_api_key(provider: &str) -> Result<()> {
    let key_name = format!("{}_api_key", provider.to_lowercase());
    let entry = Entry::new(SERVICE_NAME, &key_name)
        .map_err(|e| anyhow!("Failed to access credential store: {}", e))?;
    
    let _ = entry.delete_password();
    Ok(())
}
