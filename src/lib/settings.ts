// User settings, persisted in localStorage.
export interface Settings {
  outputDir: string;
  fps: 30 | 60;
  scale: 1 | 0.5;
  codec: "h264" | "hevc";
  systemAudio: boolean;
  mic: boolean;
  micId?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  outputDir: "",
  fps: 60,
  scale: 1,
  codec: "h264",
  systemAudio: false,
  mic: false,
};

const KEY = "tix.settings";

// Merge stored values over defaults so new fields are never undefined.
export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Write the whole blob.
export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}