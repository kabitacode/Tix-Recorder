use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::sidecar;

#[derive(Default)]
pub struct RecState(Mutex<Option<Child>>);

pub const EVENT: &str = "recording-event";

#[tauri::command]
pub async fn start_recording(app: AppHandle, opts: serde_json::Value) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || spawn(app, opts)).await.map_err(|e| e.to_string())?
}

fn spawn(app: AppHandle, opts: serde_json::Value) -> Result<String, String> {
    let state = app.state::<RecState>();
    let mut guard = state.0.lock().unwrap();
    if guard.is_some() {
        return Err("Already recording".into());
    }
    if let Some(parent) = opts["output"].as_str().and_then(|p| std::path::Path::new(p).parent()) {
        std::fs::create_dir_all(parent).map_err(|e| format!("output folder: {e}"))?;
    }
    let mut child = Command::new(sidecar::path())
        .arg("record")
        .arg(opts.to_string())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("spawn recorder: {e}"))?;

    let mut reader = BufReader::new(child.stdout.take().unwrap());
    let mut line = String::new();
    let _ = reader.read_line(&mut line);
    let first: serde_json::Value = match serde_json::from_str(&line) {
        Ok(v) => v,
        Err(_) => {
            let _ = child.wait();
            return Err("Recorder exited unexpectedly".into());
        }
    };
    if first["event"] != "started" {
        let _ = child.wait();
        return Err(first["message"].as_str().unwrap_or("Failed to start").to_string());
    }
    let path = first["path"].as_str().unwrap_or_default().to_string();
    *guard = Some(child);
    drop(guard);

    std::thread::spawn(move || {
        for l in reader.lines().map_while(Result::ok) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&l) {
                let _ = app.emit(EVENT, v);
            }
        }
        if let Some(mut c) = app.state::<RecState>().0.lock().unwrap().take() {
            let _ = c.wait();
        }
        let _ = app.emit(EVENT, serde_json::json!({ "event": "exited" }));
    });
    Ok(path)
}

fn send(state: &State<RecState>, cmd: &str) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    let child = guard.as_mut().ok_or("Not recording")?;
    let stdin = child.stdin.as_mut().ok_or("stdin closed")?;
    stdin.write_all(format!("{cmd}\n").as_bytes()).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_recording(state: State<RecState>) -> Result<(), String> {
    send(&state, "stop")
}

#[tauri::command]
pub fn pause_recording(state: State<RecState>) -> Result<(), String> {
    send(&state, "pause")
}

#[tauri::command]
pub fn resume_recording(state: State<RecState>) -> Result<(), String> {
    send(&state, "resume")
}
