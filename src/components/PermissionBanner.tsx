// Banner for missing Screen Recording / Microphone access.
import { ShieldAlert } from "lucide-react";
import { openPrivacySettings, requestPermissions } from "../lib/recorder";
import type { PrivacyPane } from "../lib/types";

const TEXT: Record<PrivacyPane, string> = {
  screen: "Screen Recording permission is required. Enable it for Tix Recorder in System Settings, then relaunch the app.",
  microphone: "Microphone access was denied. Enable it for Tix Recorder in System Settings, then record again.",
  camera: "Camera access was denied. Enable it for Tix Recorder in System Settings.",
};

// Text per privacy pane plus a button that tries to resolve it.
export default function PermissionBanner({ pane, onChanged }: { pane: PrivacyPane; onChanged?: () => void }) {
  // Screen: retry the system prompt first, it may still be allowed to show.
  // Otherwise open the matching Privacy pane and let the parent re-check.
  const fix = async () => {
    if (pane === "screen") {
      const r = await requestPermissions();
      if (r.screenPermission) return onChanged?.();
    }
    await openPrivacySettings(pane);
    onChanged?.();
  };
  return (
    <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 text-xs text-amber-200">
      <ShieldAlert size={14} className="shrink-0" />
      <span className="flex-1">{TEXT[pane]}</span>
      <button type="button" onClick={fix} className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-white hover:bg-white/20">
        Open Settings
      </button>
    </div>
  );
}
