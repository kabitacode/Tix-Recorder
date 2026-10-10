// Windows backend: drives a bundled static ffmpeg.exe (binaries/ffmpeg).
// Capture uses gdigrab (display / window / area), microphone uses dshow.
// Pause/resume records one segment per resume and joins them with the concat demuxer.
pub mod recording;
pub mod screenshot;
pub mod sources;

use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn ffmpeg() -> Command {
    let exe = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("ffmpeg.exe")))
        .unwrap_or_else(|| "ffmpeg.exe".into());
    hidden(exe)
}

pub fn hidden(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut c = Command::new(program);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}
