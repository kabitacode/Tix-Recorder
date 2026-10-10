use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn default_output_dir(app: AppHandle) -> Result<String, String> {
    let dir = app.path().video_dir().map_err(|e| e.to_string())?.join("Tix Recorder");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_privacy_settings(app: AppHandle, pane: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let url = {
        let anchor = match pane.as_str() {
            "microphone" => "Privacy_Microphone",
            "camera" => "Privacy_Camera",
            _ => "Privacy_ScreenCapture",
        };
        format!("x-apple.systempreferences:com.apple.preference.security?{anchor}")
    };
    #[cfg(windows)]
    let url = match pane.as_str() {
        "microphone" => "ms-settings:privacy-microphone",
        "camera" => "ms-settings:privacy-webcam",
        _ => "ms-settings:privacy",
    }
    .to_string();
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}
