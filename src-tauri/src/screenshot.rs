use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn take_screenshot(app: AppHandle, mode: String, path: String) -> Result<Option<String>, String> {
    let win = app.get_webview_window("main");
    if let Some(w) = &win {
        let _ = w.hide();
    }
    let args: &[&str] = match mode.as_str() {
        "window" => &["-i", "-W", "-x"],
        "area" => &["-i", "-x"],
        _ => &["-x"],
    };
    let out = PathBuf::from(&path);
    let result = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_millis(250));
        Command::new("screencapture").args(args).arg(&out).status()
    })
    .await;
    if let Some(w) = &win {
        let _ = w.show();
    }
    let status = result.map_err(|e| e.to_string())?.map_err(|e| format!("screencapture: {e}"))?;
    if !status.success() {
        return Err("screencapture failed".into());
    }
    Ok(std::fs::metadata(&path).is_ok().then_some(path))
}
