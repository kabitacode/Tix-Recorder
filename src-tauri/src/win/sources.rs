use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::AppHandle;

// Titles from the last window listing; the frontend refers to windows by index.
static TITLES: Mutex<Vec<String>> = Mutex::new(Vec::new());

pub fn window_title(id: usize) -> Option<String> {
    TITLES.lock().unwrap().get(id).cloned()
}

// Physical pixel geometry of one monitor, as gdigrab expects.
pub struct Display {
    pub id: usize,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

pub fn displays(app: &AppHandle) -> Vec<Display> {
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(id, m)| Display {
            id,
            x: m.position().x,
            y: m.position().y,
            width: m.size().width,
            height: m.size().height,
            scale: m.scale_factor(),
        })
        .collect()
}

// gdigrab offsets are relative to the virtual screen's top-left corner.
pub fn virtual_origin(ds: &[Display]) -> (i32, i32) {
    (ds.iter().map(|d| d.x).min().unwrap_or(0), ds.iter().map(|d| d.y).min().unwrap_or(0))
}

fn list_windows() -> Vec<Value> {
    let script = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; \
        Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | \
        Select-Object ProcessName, MainWindowTitle | ConvertTo-Json -Compress";
    let Ok(out) = super::hidden("powershell").args(["-NoProfile", "-NonInteractive", "-Command", script]).output() else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let parsed: Value = serde_json::from_str(text.trim()).unwrap_or(Value::Null);
    let items = match parsed {
        Value::Array(a) => a,
        Value::Object(_) => vec![parsed],
        _ => Vec::new(),
    };
    let mut titles = TITLES.lock().unwrap();
    titles.clear();
    items
        .iter()
        .filter_map(|w| {
            let title = w["MainWindowTitle"].as_str()?;
            let app = w["ProcessName"].as_str().unwrap_or("");
            titles.push(title.to_string());
            Some(json!({ "id": titles.len() - 1, "title": title, "app": app }))
        })
        .collect()
}

// Parses `ffmpeg -list_devices true -f dshow -i dummy`, which prints to stderr lines like
//   [dshow @ ...] "Microphone (Realtek Audio)" (audio)
fn list_mics() -> Vec<Value> {
    let Ok(out) = super::ffmpeg().args(["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"]).output() else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&out.stderr);
    text.lines()
        .filter(|l| l.trim_end().ends_with("(audio)"))
        .filter_map(|l| {
            let start = l.find('"')? + 1;
            let end = start + l[start..].find('"')?;
            let name = &l[start..end];
            Some(json!({ "id": name, "name": name }))
        })
        .collect()
}

#[tauri::command]
pub async fn list_sources(app: AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let displays: Vec<Value> = displays(&app)
            .iter()
            .map(|d| {
                json!({
                    "id": d.id,
                    "x": d.x as f64 / d.scale,
                    "y": d.y as f64 / d.scale,
                    "width": d.width as f64 / d.scale,
                    "height": d.height as f64 / d.scale,
                })
            })
            .collect();
        json!({
            "platform": "windows",
            "screenPermission": true,
            "micPermission": "authorized",
            "supportsSystemAudio": false,
            "displays": displays,
            "windows": list_windows(),
            "mics": list_mics(),
        })
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_permissions() -> Result<Value, String> {
    Ok(json!({ "screenPermission": true, "micPermission": "authorized" }))
}
