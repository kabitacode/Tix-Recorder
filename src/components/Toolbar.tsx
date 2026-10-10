// Main toolbar row.
import { AppWindow, Camera, ChevronDown, Folder, GripVertical, Mic, MicOff, Minus, Monitor, Settings, SquareDashed, Volume2, VolumeX, Webcam, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Divider from "./Divider";
import RecordButton from "./RecordButton";
import ToolButton from "./ToolButton";
import type { RecStatus } from "../hooks/useRecorder";
import type { Mode, Panel } from "../lib/types";

export interface ToolbarProps {
  mode: Mode;
  onMode: (m: Mode) => void;
  areaLabel?: string;
  camera: boolean;
  onCamera: () => void;
  systemAudio: boolean;
  systemAudioDisabledReason?: string;
  onSystemAudio: () => void;
  mic: boolean;
  onMic: () => void;
  panel: Panel;
  onPanel: (p: Panel) => void;
  status: RecStatus;
  pending: boolean;
  elapsed: number;
  recordDisabledReason?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onScreenshot: () => void;
  onClose: () => void;
}

const ICON = 18;

// Mode and audio buttons lock while recording. toggle() opens/closes a panel.
export default function Toolbar(p: ToolbarProps) {
  const locked = p.status !== "idle";
  const toggle = (x: Panel) => p.onPanel(p.panel === x ? null : x);
  return (
    <div data-tauri-drag-region className="flex h-13 shrink-0 items-center gap-0.5 px-2">
      <div data-tauri-drag-region className="flex h-full w-7 cursor-grab items-center justify-center active:cursor-grabbing">
        <GripVertical size={14} className="pointer-events-none text-white/30" />
      </div>

      <ToolButton icon={<Monitor size={ICON} />} label="Display" active={p.mode === "display"} disabled={locked} onClick={() => p.onMode("display")} />
      <ToolButton icon={<AppWindow size={ICON} />} label="Window" active={p.mode === "window"} disabled={locked} onClick={() => p.onMode("window")} />
      <ToolButton icon={<SquareDashed size={ICON} />} label={p.areaLabel ?? "Area"} active={p.mode === "area"} disabled={locked} onClick={() => p.onMode("area")} />
      <ToolButton icon={<Camera size={ICON} />} label="Shot" title="Screenshot" disabled={locked} onClick={p.onScreenshot} />

      <Divider />

      <ToolButton icon={<Webcam size={ICON} />} title="Camera overlay" active={p.camera} onClick={p.onCamera} />
      <ToolButton
        icon={p.systemAudio ? <Volume2 size={ICON} /> : <VolumeX size={ICON} />}
        title={p.systemAudioDisabledReason ?? "System audio"}
        active={p.systemAudio && !p.systemAudioDisabledReason}
        disabled={locked || !!p.systemAudioDisabledReason}
        onClick={p.onSystemAudio}
      />
      <div className="flex items-center">
        <ToolButton icon={p.mic ? <Mic size={ICON} /> : <MicOff size={ICON} />} title="Microphone" active={p.mic} disabled={locked} onClick={p.onMic} />
        <button
          type="button"
          title="Select microphone"
          disabled={locked}
          onClick={() => toggle("mic")}
          className={`-ml-1 flex h-11 w-5 items-center justify-center rounded-lg hover:text-white disabled:opacity-30 ${p.panel === "mic" ? "text-white" : "text-white/50"}`}
        >
          <ChevronDown size={12} />
        </button>
      </div>

      <Divider />

      <RecordButton
        status={p.status}
        pending={p.pending}
        elapsed={p.elapsed}
        disabled={!!p.recordDisabledReason}
        title={p.recordDisabledReason}
        onStart={p.onStart}
        onPause={p.onPause}
        onResume={p.onResume}
        onStop={p.onStop}
      />

      <Divider />

      <ToolButton icon={<Folder size={ICON} />} title="Recordings" active={p.panel === "recordings"} onClick={() => toggle("recordings")} />
      <ToolButton icon={<Settings size={ICON} />} title="Settings" active={p.panel === "settings"} onClick={() => toggle("settings")} />

      <div className="ml-1 flex h-full flex-col justify-between py-1">
        <button type="button" title="Minimize" onClick={() => getCurrentWindow().minimize()} className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white">
          <Minus size={12} />
        </button>
        <button type="button" title="Close" onClick={p.onClose} className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:bg-red-500/70 hover:text-white">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
