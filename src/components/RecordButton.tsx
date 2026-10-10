// Record control that changes shape with the recording status.
// Idle/starting: a single red button that starts the recording.
// Recording/paused/stopping: a Pause/Resume toggle next to a Stop button that shows
// the elapsed time. Buttons lock while a command is in flight (pending) or while
// the sidecar finalizes the file (stopping), so a double click cannot send two commands.
import { Circle, Loader2, Pause, Play, Square } from "lucide-react";
import { formatDuration } from "../lib/format";
import type { RecStatus } from "../hooks/useRecorder";

interface Props {
  status: RecStatus;
  pending?: boolean;
  elapsed: number;
  disabled?: boolean;
  title?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function RecordButton({ status, pending, elapsed, disabled, title, onStart, onPause, onResume, onStop }: Props) {
  // Not recording yet: only the start button is shown.
  if (status === "idle" || status === "starting") {
    return (
      <button
        type="button"
        disabled={disabled || status === "starting"}
        title={title ?? "Start recording"}
        onClick={onStart}
        className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-red-500 px-3 text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "starting" ? <Loader2 size={14} className="animate-spin" /> : <Circle size={14} fill="currentColor" />}
      </button>
    );
  }

  const paused = status === "paused";
  const busy = pending || status === "stopping";
  return (
    <div className="flex items-center gap-1">
      {/* Pause while recording, Resume while paused. Spinner until the sidecar confirms. */}
      <button
        type="button"
        disabled={busy}
        title={paused ? "Resume" : "Pause"}
        onClick={paused ? onResume : onPause}
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${paused ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" : "bg-white/10 text-white hover:bg-white/15"}`}
      >
        {pending && status !== "stopping" ? <Loader2 size={14} className="animate-spin" /> : paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
      </button>
      {/* Stop always finalizes the file; the timer dims while paused. */}
      <button
        type="button"
        disabled={busy}
        title="Stop recording"
        onClick={onStop}
        className="flex h-10 items-center gap-2 rounded-xl bg-red-500/20 px-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-40"
      >
        {status === "stopping" ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} fill="currentColor" />}
        <span className={`tabular-nums ${paused ? "text-white/50" : ""}`}>{formatDuration(elapsed)}</span>
      </button>
    </div>
  );
}
