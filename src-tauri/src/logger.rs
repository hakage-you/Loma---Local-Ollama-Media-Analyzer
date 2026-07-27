use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct Logger {
    log_file_path: PathBuf,
}

static LOGGER_INSTANCE: Mutex<Option<Logger>> = Mutex::new(None);

/// LLM 詳細デバッグログの有効フラグ。
/// 設定 `llm_debug_logging` もしくは環境変数 `LOMA_DEBUG_LLM=1` で有効化される。
static LLM_DEBUG_ENABLED: AtomicBool = AtomicBool::new(false);

/// 設定値に基づいて LLM デバッグログの ON/OFF を切り替える。
/// 環境変数 `LOMA_DEBUG_LLM=1` が設定されている場合は設定値によらず常に有効。
pub fn set_llm_debug_enabled(enabled: bool) {
    let forced = std::env::var("LOMA_DEBUG_LLM")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    LLM_DEBUG_ENABLED.store(enabled || forced, Ordering::Relaxed);
}

pub fn is_llm_debug_enabled() -> bool {
    LLM_DEBUG_ENABLED.load(Ordering::Relaxed)
}

/// LLM デバッグログ出力（有効時のみログファイルに書き込まれる）
pub fn log_debug(message: &str) {
    if is_llm_debug_enabled() {
        write_log("DEBUG", message);
    }
}

pub fn init_logger(app_handle: &AppHandle) {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./data"));
    
    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }

    let log_file_path = app_dir.join("loma.log");
    let logger = Logger { log_file_path };

    let mut instance = LOGGER_INSTANCE.lock().unwrap();
    *instance = Some(logger);
}

#[allow(dead_code)]
pub fn log_info(message: &str) {
    write_log("INFO", message);
}

pub fn log_error(message: &str) {
    write_log("ERROR", message);
}

fn write_log(level: &str, message: &str) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let log_line = format!("[{}] [{}] {}\n", timestamp, level, message);

    // デバッグ出力
    println!("{}", log_line.trim_end());

    let instance = LOGGER_INSTANCE.lock().unwrap();
    if let Some(ref logger) = *instance {
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&logger.log_file_path)
        {
            let _ = file.write_all(log_line.as_bytes());
        }
    }
}

pub fn read_logs(app_handle: &AppHandle) -> String {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./data"));
    let log_file_path = app_dir.join("loma.log");

    if log_file_path.exists() {
        fs::read_to_string(log_file_path).unwrap_or_default()
    } else {
        String::new()
    }
}

pub fn clear_logs(app_handle: &AppHandle) {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./data"));
    let log_file_path = app_dir.join("loma.log");

    if log_file_path.exists() {
        let _ = fs::remove_file(log_file_path);
    }
}
