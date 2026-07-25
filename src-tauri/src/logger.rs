use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct Logger {
    log_file_path: PathBuf,
}

static LOGGER_INSTANCE: Mutex<Option<Logger>> = Mutex::new(None);

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
