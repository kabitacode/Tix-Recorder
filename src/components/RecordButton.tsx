// Record / stop button with timer.
import { Circle, Loader2, Square } from "lucide-react";
import { formatDuration } from "../lib/format";
import type { RecStatus } from "../hooks/useRecorder";

interface Props {
  status: RecStatus;
  elapsed: number;
  disabled?: boolean;
  title?: string;
  onStart: () => void;
  onStop: () => void;
}

// Disabled while starting/stopping so start and stop cannot overlap.
export default function RecordButton({ status, elapsed, disabled, title, onStart, onStop }: Props) {
  const busy = status === "starting" || status === "stopping";
  const rec = status === "recording";
  return (
    <button
      type="button"
      disabled={disabled || busy}
      title={title ?? (rec ? "Stop recording" : "Start recording")}
      onClick={rec ? onStop : onStart}
      className={`flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40
        ${rec ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-red-500 text-white hover:bg-red-400"}`}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : rec ? (
        <>
          <Square size={14} fill="currentColor" />
          <span className="tabular-nums">{formatDuration(elapsed)}</span>
        </>
      ) : (
        <Circle size={14} fill="currentColor" />
      )}
    </button>
  );
}
