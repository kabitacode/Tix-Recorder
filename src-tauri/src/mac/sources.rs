use std::path::PathBuf;
use std::process::Command;

pub fn path() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("recorder")))
        .unwrap_or_else(|| PathBuf::from("recorder"))
}

fn run(arg: &str) -> Result<serde_json::Value, String> {
    let out = Command::new(path()).arg(arg).output().map_err(|e| format!("sidecar: {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout);
    let line = text.lines().last().unwrap_or("");
    serde_json::from_str(line).map_err(|e| format!("sidecar {arg}: {e} ({})", String::from_utf8_lossy(&out.stderr)))
}

#[tauri::command]
pub async fn list_sources() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| run("list")).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn request_permissions() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| run("request")).await.map_err(|e| e.to_string())?
}
