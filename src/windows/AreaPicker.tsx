// Drag-to-select overlay for the "area" window.
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { AREA_CANCELLED, AREA_SELECTED } from "../lib/areaPicker";

type P = { x: number; y: number };

// Tracks drag start/current points; the rectangle is derived from them.
export default function AreaPicker() {
  const [start, setStart] = useState<P | null>(null);
  const [cur, setCur] = useState<P | null>(null);

  // Esc anywhere cancels the pick.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && emit(AREA_CANCELLED);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Normalize so dragging up/left still gives a positive box.
  const rect =
    start && cur
      ? {
          x: Math.min(start.x, cur.x),
          y: Math.min(start.y, cur.y),
          width: Math.abs(cur.x - start.x),
          height: Math.abs(cur.y - start.y),
        }
      : null;

  // Mouse up: send the box to the main window, ignore tiny misclicks.
  const finish = () => {
    if (rect && rect.width >= 16 && rect.height >= 16) {
      emit(AREA_SELECTED, {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    setStart(null);
    setCur(null);
  };

  return (
    <div
      className="fixed inset-0 cursor-crosshair select-none"
      style={{ background: rect ? "transparent" : "rgba(0,0,0,0.3)" }}
      onMouseDown={(e) => {
        setStart({ x: e.clientX, y: e.clientY });
        setCur({ x: e.clientX, y: e.clientY });
      }}
      onMouseMove={(e) => start && setCur({ x: e.clientX, y: e.clientY })}
      onMouseUp={finish}
    >
      {rect ? (
        <div
          className="absolute border border-white/80"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, boxShadow: "0 0 0 100000px rgba(0,0,0,0.3)" }}
        >
          <span className="absolute -top-7 left-0 rounded bg-neutral-900/90 px-2 py-1 font-mono text-xs text-white">
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </span>
        </div>
      ) : (
        <div className="absolute inset-x-0 top-12 flex justify-center">
          <span className="rounded-full bg-neutral-900/90 px-4 py-2 text-sm text-white/80">Drag to select an area · Esc to cancel</span>
        </div>
      )}
    </div>
  );
}
