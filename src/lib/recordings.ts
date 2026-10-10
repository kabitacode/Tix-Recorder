// Wrappers for the Rust recordings commands (list, delete, open, reveal).
import { invoke } from "@tauri-apps/api/core";

export interface Recording {
  name: string;
  path: string;
  size: number;
  modified: number;
  kind: "video" | "image";
}

export const listRecordings = (dir: string) => invoke<Recording[]>("list_recordings", { dir });
export const deleteRecording = (path: string) => invoke<void>("delete_recording", { path });
export const openPath = (path: string) => invoke<void>("open_path", { path });
export const revealPath = (path: string) => invoke<void>("reveal_path", { path });