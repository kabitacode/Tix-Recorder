// Webcam overlay window open/close.
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor } from "@tauri-apps/api/window";

// Sidecar hides all our windows from the capture except ones with this title.
export const CAMERA_TITLE = "Tix Camera";
const SIZE = 220;

// Opens near bottom-left of the current monitor. No-op if already open.
export async function openCamera(onClosed: () => void) {
  if (await WebviewWindow.getByLabel("camera")) return;
  const mon = await currentMonitor();
  const s = mon?.scaleFactor ?? 1;
  const win = new WebviewWindow("camera", {
    url: "/#camera",
    title: CAMERA_TITLE,
    width: SIZE,
    height: SIZE,
    x: mon ? mon.position.x / s + 24 : undefined,
    y: mon ? (mon.position.y + mon.size.height) / s - SIZE - 80 : undefined,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    shadow: false,
    focus: false,
  });
  win.once("tauri://destroyed", onClosed);
}

// Close if open.
export async function closeCamera() {
  const win = await WebviewWindow.getByLabel("camera");
  await win?.close();
}