use serde_json::json;
use std::process::Stdio;
use tauri::{AppHandle, Manager};

use super::recording::{build_input, Opts};

#[tauri::command]
pub async fn take_screenshot(
    app: AppHandle,
    mode: String,
    path: String,
    display_id: Option<usize>,
    window_id: Option<usize>,
    rect: Option<[f64; 4]>,
) -> Result<Option<String>, String> {
    let win = app.get_webview_window("main");
    if let Some(w) = &win {
        let _ = w.hide();
    }
    let out_path = path.clone();
    let app2 = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        std::thread::sleep(std::time::Duration::from_millis(300));
        let o: Opts = serde_json::from_value(json!({
            "mode": mode, "displayId": display_id, "windowId": window_id, "rect": rect, "output": out_path, "fps": 30
        }))
        .map_err(|e| e.to_string())?;
        let input = build_input(&app2, &o)?;
        let out = super::ffmpeg()
            .args(["-hide_banner", "-loglevel", "error", "-y"])
            .args(&input)
            .args(["-frames:v", "1"])
            .arg(&out_path)
            .stdin(Stdio::null())
            .output()
            .map_err(|e| format!("ffmpeg: {e}"))?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr);
            return Err(err.lines().last().unwrap_or("Screenshot failed").to_string());
        }
        Ok(())
    })
    .await;
    if let Some(w) = &win {
        let _ = w.show();
    }
    result.map_err(|e| e.to_string())??;
    Ok(std::fs::metadata(&path).is_ok().then_some(path))
}
