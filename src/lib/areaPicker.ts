// Area selection: opens the overlay window and waits for a rectangle.
import { once } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { cursorPosition, monitorFromPoint, primaryMonitor } from "@tauri-apps/api/window";
import type { Area } from "./types";

export const AREA_SELECTED = "area-selected";
export const AREA_CANCELLED = "area-cancelled";

// Covers the monitor under the cursor. Resolves with the box in logical px
// plus the monitor origin, or null on cancel / window closed.
export async function pickArea(): Promise<Area | null> {
  const pos = await cursorPosition();
  const mon = (await monitorFromPoint(pos.x, pos.y)) ?? (await primaryMonitor());
  if (!mon) return null;
  const s = mon.scaleFactor;
  const monitorX = mon.position.x / s;
  const monitorY = mon.position.y / s;

  const win = new WebviewWindow("area", {
    url: "/#area",
    x: monitorX,
    y: monitorY,
    width: mon.size.width / s,
    height: mon.size.height / s,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    shadow: false,
    focus: true,
  });

  return new Promise((resolve) => {
    // finish() may be hit by selected, cancelled and destroyed; only first counts.
    let done = false;
    const finish = (a: Area | null) => {
      if (done) return;
      done = true;
      win.close().catch(() => {});
      resolve(a);
    };
    once<Omit<Area, "monitorX" | "monitorY">>(AREA_SELECTED, (e) => finish({ ...e.payload, monitorX, monitorY }));
    once(AREA_CANCELLED, () => finish(null));
    win.once("tauri://destroyed", () => finish(null));
  });
}