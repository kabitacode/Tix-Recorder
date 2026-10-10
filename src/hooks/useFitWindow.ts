// Resizes the Tauri window to match the rendered content size.
import { useEffect, type RefObject } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export function useFitWindow(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const win = getCurrentWindow();
    const fit = () => win.setSize(new LogicalSize(el.offsetWidth, el.offsetHeight));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}