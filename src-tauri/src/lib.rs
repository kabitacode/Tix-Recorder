mod paths;
mod recordings;

#[cfg(target_os = "macos")]
mod mac;
#[cfg(target_os = "macos")]
use mac as platform;

#[cfg(windows)]
mod win;
#[cfg(windows)]
use win as platform;

#[cfg(not(any(target_os = "macos", windows)))]
compile_error!("Tix Recorder supports macOS and Windows only");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(platform::recording::RecState::default())
        .invoke_handler(tauri::generate_handler![
            platform::sources::list_sources,
            platform::sources::request_permissions,
            platform::recording::start_recording,
            platform::recording::stop_recording,
            platform::recording::pause_recording,
            platform::recording::resume_recording,
            platform::screenshot::take_screenshot,
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
