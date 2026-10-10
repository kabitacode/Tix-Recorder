// Shared types. Most mirror the JSON exchanged with the Swift sidecar.
// UI-level unions.
export type Mode = "display" | "window" | "area";
export type Panel = "mic" | "window" | "recordings" | "settings" | null;

// Returned by the sidecar "list" command.
export interface DisplayInfo {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInfo {
  id: number;
  title: string;
  app: string;
}

export interface MicInfo {
  id: string;
  name: string;
}

export type AuthStatus = "authorized" | "denied" | "notDetermined";
export type PrivacyPane = "screen" | "microphone" | "camera";

export interface Sources {
  screenPermission: boolean;
  micPermission: AuthStatus;
  displays?: DisplayInfo[];
  windows?: WindowInfo[];
  mics: MicInfo[];
}

// Area pick result: box in logical px relative to the monitor origin.
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
  monitorX: number;
  monitorY: number;
}

// Payload for the sidecar "record" command.
export interface RecordOptions {
  mode: Mode;
  displayId?: number;
  windowId?: number;
  rect?: [number, number, number, number];
  output: string;
  fps?: number;
  scale?: number;
  codec?: "h264" | "hevc";
  systemAudio?: boolean;
  micId?: string;
  keepTitles?: string[];
}

// Streamed back from the sidecar while recording.
export type RecordingEvent =
  | { event: "paused" }
  | { event: "resumed" }
  | { event: "stopped"; path: string }
  | { event: "error"; message: string; path?: string }
  | { event: "exited" };