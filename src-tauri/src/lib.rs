mod paths;
mod recording;
mod recordings;
mod screenshot;
mod sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(recording::RecState::default())
        .invoke_handler(tauri::generate_handler![
            sidecar::list_sources,
            sidecar::request_permissions,
            recording::start_recording,
            recording::stop_recording,
            recording::pause_recording,
            recording::resume_recording,
            screenshot::take_screenshot,
            paths::default_output_dir,
            paths::open_privacy_settings,
            recordings::list_recordings,
            recordings::delete_recording,
            recordings::open_path,
            recordings::reveal_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
