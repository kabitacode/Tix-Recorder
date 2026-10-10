// Wrappers for the Rust recording commands.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Mode, PrivacyPane, RecordOptions, RecordingEvent, Sources } from "./types";

export const listSources = () => invoke<Sources>("list_sources");
export const requestPermissions = () => invoke<Pick<Sources, "screenPermission" | "micPermission">>("request_permissions");
export const openPrivacySettings = (pane: PrivacyPane) => invoke<void>("open_privacy_settings", { pane });
export const defaultOutputDir = () => invoke<string>("default_output_dir");

export const startRecording = (opts: RecordOptions) => invoke<string>("start_recording", { opts });
export const stopRecording = () => invoke<void>("stop_recording");
export const takeScreenshot = (mode: Mode, path: string) => invoke<string | null>("take_screenshot", { mode, path });

// Events the Rust side emits while the sidecar runs (stopped / error / exited).
export const onRecordingEvent = (cb: (e: RecordingEvent) => void) => listen<RecordingEvent>("recording-event", (e) => cb(e.payload));

// "<dir>/<prefix> YYYY-MM-DD HH.MM.SS.<ext>"
export function outputFile(dir: string, prefix: string, ext: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
  return `${dir}/${prefix} ${stamp}.${ext}`;
}