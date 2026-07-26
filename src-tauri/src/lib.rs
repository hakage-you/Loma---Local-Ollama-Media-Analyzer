mod batch;
mod commands;
mod credentials;
mod db;
mod llm;
mod logger;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            logger::init_logger(&handle);
            tauri::async_runtime::block_on(async move {
                let pool = db::init_db(&handle)
                    .await
                    .expect("Failed to initialize database");
                handle.manage(db::DbState { pool });
            });

            app.manage(commands::ScanState {
                cancel_flag: Arc::new(AtomicBool::new(false)),
                pause_flag: Arc::new(AtomicBool::new(false)),
                is_running: Arc::new(AtomicBool::new(false)),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_media,
            commands::start_scan,
            commands::cancel_scan,
            commands::pause_scan,
            commands::resume_scan,
            commands::get_scan_status,
            commands::get_settings,
            commands::update_setting,
            commands::get_available_models,
            commands::get_all_tags,
            commands::get_parent_folders,
            commands::get_scan_folders,
            commands::rescan_all_folders,
            commands::reanalyze_all_media,
            commands::reanalyze_folder,
            commands::remove_scan_folder,
            commands::retry_media,
            commands::unload_model,
            commands::get_app_logs,
            commands::clear_app_logs,
            commands::rename_tag,
            commands::merge_tags,
            commands::suggest_tag_merges,
            commands::get_media_by_tag,
            commands::get_or_create_tag,
            commands::add_tag_to_media,
            commands::remove_tag_from_media,
            commands::open_file,
            commands::open_folder,
            commands::check_and_open_file,
            commands::load_tag_suggestions_cache,
            commands::save_tag_suggestions_cache,
            commands::clear_tag_suggestions_cache,
            commands::custom_analyze_video,
            commands::save_provider_api_key,
            commands::get_provider_api_key,
            commands::reanalyze_single_media,
            commands::cleanup_missing_media,
            commands::pull_ollama_model,
            commands::cancel_ollama_pull,
            commands::check_ffmpeg_installed,
            commands::sync_folders,
            commands::get_system_vram_gb,
            commands::get_effective_prompt_type,
            commands::compare_granularity_levels,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

