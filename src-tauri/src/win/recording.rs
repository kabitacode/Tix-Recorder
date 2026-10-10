use serde::Deserialize;
use serde_json::{json, Value};
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use super::sources::{displays, virtual_origin, window_title};

pub const EVENT: &str = "recording-event";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Opts {
    pub mode: String,
    pub display_id: Option<usize>,
    pub window_id: Option<usize>,
    pub rect: Option<[f64; 4]>,
    pub output: String,
    pub fps: Option<u32>,
    pub scale: Option<f64>,
    pub codec: Option<String>,
    pub mic_id: Option<String>,
}

struct Session {
    child: Child,
    input: Vec<String>,
    encode: Vec<String>,
    segments: Vec<PathBuf>,
    logs: Vec<PathBuf>,
    output: PathBuf,
    paused: bool,
}

#[derive(Default)]
pub struct RecState(Mutex<Option<Session>>);

fn tmp(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("tix-{}-{name}", std::process::id()))
}

// Input half of the ffmpeg command line: screen source (+ optional microphone).
pub fn build_input(app: &AppHandle, o: &Opts) -> Result<Vec<String>, String> {
    let fps = o.fps.unwrap_or(60).to_string();
    let mut a: Vec<String> = ["-f", "gdigrab", "-framerate", &fps, "-draw_mouse", "1", "-thread_queue_size", "1024"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    if o.mode == "window" {
        let title = o.window_id.and_then(window_title).ok_or("Window not found. Pick it again.")?;
        a.push("-i".into());
        a.push(format!("title={title}"));
    } else {
        let ds = displays(app);
        let d = o
            .display_id
            .and_then(|id| ds.iter().find(|d| d.id == id))
            .or(ds.first())
            .ok_or("Display not found")?;
        let (vx, vy) = virtual_origin(&ds);
        let (mut x, mut y, mut w, mut h) = (d.x, d.y, d.width, d.height);
        if o.mode == "area" {
            if let Some(r) = o.rect {
                x = d.x + (r[0] * d.scale).round() as i32;
                y = d.y + (r[1] * d.scale).round() as i32;
                w = (r[2] * d.scale).round() as u32;
                h = (r[3] * d.scale).round() as u32;
            }
        }
        let w = w.max(2) / 2 * 2;
        let h = h.max(2) / 2 * 2;
        for s in ["-offset_x", &(x - vx).to_string(), "-offset_y", &(y - vy).to_string(), "-video_size", &format!("{w}x{h}"), "-i", "desktop"] {
            a.push(s.to_string());
        }
    }
    if let Some(mic) = &o.mic_id {
        for s in ["-f", "dshow", "-thread_queue_size", "1024", "-rtbufsize", "100M", "-i", &format!("audio={mic}")] {
            a.push(s.to_string());
        }
    }
    Ok(a)
}

// Output half: scaling, video codec, optional audio codec.
fn build_encode(o: &Opts) -> Vec<String> {
    let s = o.scale.unwrap_or(1.0);
    let mut a = vec!["-vf".to_string(), format!("scale=trunc(iw*{s}/2)*2:trunc(ih*{s}/2)*2")];
    let codec: &[&str] = if o.codec.as_deref() == Some("hevc") {
        &["-c:v", "libx265", "-preset", "fast", "-crf", "26", "-tag:v", "hvc1"]
    } else {
        &["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
    };
    a.extend(codec.iter().map(|s| s.to_string()));
    a.extend(["-pix_fmt", "yuv420p"].iter().map(|s| s.to_string()));
    if o.mic_id.is_some() {
        a.extend(["-c:a", "aac", "-b:a", "160k"].iter().map(|s| s.to_string()));
    }
    a
}

fn spawn_segment(input: &[String], encode: &[String], segment: &Path, log: &Path) -> Result<Child, String> {
    let log_file = File::create(log).map_err(|e| e.to_string())?;
    let mut child = super::ffmpeg()
        .args(["-hide_banner", "-loglevel", "error", "-nostats", "-y"])
        .args(input)
        .args(encode)
        .arg(segment)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::from(log_file))
        .spawn()
        .map_err(|e| format!("spawn ffmpeg: {e}"))?;
    std::thread::sleep(Duration::from_millis(900));
    if child.try_wait().map_err(|e| e.to_string())?.is_some() {
        return Err(log_tail(log));
    }
    Ok(child)
}

fn log_tail(log: &Path) -> String {
    std::fs::read_to_string(log)
        .unwrap_or_default()
        .lines()
        .rev()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("ffmpeg failed")
        .to_string()
}

// Asks ffmpeg to finish the current file ("q" on stdin) and waits for it to exit.
fn quit(child: &mut Child) -> Result<(), String> {
    if let Some(stdin) = child.stdin.as_mut() {
        let _ = stdin.write_all(b"q\n");
        let _ = stdin.flush();
    }
    drop(child.stdin.take());
    for _ in 0..100 {
        if child.try_wait().map_err(|e| e.to_string())?.is_some() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let _ = child.kill();
    let _ = child.wait();
    Err("ffmpeg did not stop in time; the last segment may be incomplete".into())
}

fn emit(app: &AppHandle, v: Value) {
    let _ = app.emit(EVENT, v);
}

#[tauri::command]
pub async fn start_recording(app: AppHandle, opts: Value) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || start(app, opts)).await.map_err(|e| e.to_string())?
}

fn start(app: AppHandle, opts: Value) -> Result<String, String> {
    let o: Opts = serde_json::from_value(opts).map_err(|e| e.to_string())?;
    {
        let state = app.state::<RecState>();
        let mut guard = state.0.lock().unwrap();
        if guard.is_some() {
            return Err("Already recording".into());
        }
        let output = PathBuf::from(&o.output);
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("output folder: {e}"))?;
        }
        let input = build_input(&app, &o)?;
        let encode = build_encode(&o);
        let segment = tmp("0.mp4");
        let log = tmp("0.log");
        let child = spawn_segment(&input, &encode, &segment, &log)?;
        *guard = Some(Session { child, input, encode, segments: vec![segment], logs: vec![log], output, paused: false });
    }
    watch(app);
    Ok(o.output)
}

// Detects ffmpeg dying mid-recording (window closed, device lost) and finalizes what exists.
fn watch(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(500));
        let state = app.state::<RecState>();
        let mut guard = state.0.lock().unwrap();
        let Some(s) = guard.as_mut() else { break };
        if s.paused {
            continue;
        }
        if let Ok(Some(_)) = s.child.try_wait() {
            let message = s.logs.last().map(|l| log_tail(l)).unwrap_or_default();
            let session = guard.take().unwrap();
            drop(guard);
            finish(&app, session, Some(message));
            break;
        }
    });
}

#[tauri::command]
pub async fn pause_recording(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RecState>();
        let mut guard = state.0.lock().unwrap();
        let s = guard.as_mut().ok_or("Not recording")?;
        if s.paused {
            return Ok(());
        }
        let result = quit(&mut s.child);
        s.paused = true;
        emit(&app, json!({ "event": "paused" }));
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn resume_recording(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RecState>();
        let mut guard = state.0.lock().unwrap();
        let s = guard.as_mut().ok_or("Not recording")?;
        if !s.paused {
            return Ok(());
        }
        let n = s.segments.len();
        let segment = tmp(&format!("{n}.mp4"));
        let log = tmp(&format!("{n}.log"));
        s.child = spawn_segment(&s.input, &s.encode, &segment, &log)?;
        s.segments.push(segment);
        s.logs.push(log);
        s.paused = false;
        emit(&app, json!({ "event": "resumed" }));
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut session = app.state::<RecState>().0.lock().unwrap().take().ok_or("Not recording")?;
        let problem = if session.paused { None } else { quit(&mut session.child).err() };
        finish(&app, session, problem);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// Joins segments into the final file, cleans temp files, and reports the outcome.
fn finish(app: &AppHandle, s: Session, problem: Option<String>) {
    let existing: Vec<PathBuf> = s
        .segments
        .iter()
        .filter(|p| p.metadata().map(|m| m.len() > 0).unwrap_or(false))
        .cloned()
        .collect();

    let result: Result<(), String> = (|| {
        if existing.is_empty() {
            return Err(problem.clone().unwrap_or_else(|| "No video data was recorded".into()));
        }
        let _ = std::fs::remove_file(&s.output);
        if existing.len() == 1 {
            return std::fs::rename(&existing[0], &s.output)
                .or_else(|_| std::fs::copy(&existing[0], &s.output).map(|_| ()))
                .map_err(|e| e.to_string());
        }
        let list = tmp("concat.txt");
        let body: String = existing
            .iter()
            .map(|p| format!("file '{}'\n", p.to_string_lossy().replace('\\', "/").replace('\'', "'\\''")))
            .collect();
        std::fs::write(&list, body).map_err(|e| e.to_string())?;
        let out = super::ffmpeg()
            .args(["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i"])
            .arg(&list)
            .args(["-c", "copy"])
            .arg(&s.output)
            .stdin(Stdio::null())
            .output()
            .map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&list);
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr);
            return Err(err.lines().last().unwrap_or("Joining segments failed").to_string());
        }
        Ok(())
    })();

    for p in s.segments.iter().chain(s.logs.iter()) {
        let _ = std::fs::remove_file(p);
    }
    let path = s.output.to_string_lossy().into_owned();
    match result {
        Ok(()) => {
            if let Some(p) = problem {
                emit(app, json!({ "event": "error", "message": p }));
            }
            emit(app, json!({ "event": "stopped", "path": path }));
        }
        Err(e) => emit(app, json!({ "event": "error", "message": e, "path": path })),
    }
}
