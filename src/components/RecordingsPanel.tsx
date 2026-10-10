// Saved recordings list.
import { useEffect, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { Film, FolderOpen, Image, Play, Trash2 } from "lucide-react";
import { formatDate, formatSize } from "../lib/format";
import { deleteRecording, listRecordings, openPath, revealPath, type Recording } from "../lib/recordings";

interface Props {
  dir: string;
  revision: number;
  onError: (msg: string) => void;
}

// Lists files in dir; revision bumps when a new recording lands.
export default function RecordingsPanel({ dir, revision, onError }: Props) {
  const [items, setItems] = useState<Recording[]>([]);

  // Fetch the file list from Rust.
  const load = () => {
    if (dir) listRecordings(dir).then(setItems).catch((e) => onError(String(e)));
  };
  // Reload on folder change or after a recording finishes.
  useEffect(load, [dir, revision]);

  // Files can change outside the app (Finder, other tools): refresh on focus and poll while open.
  useEffect(() => {
    window.addEventListener("focus", load);
    const t = setInterval(load, 3000);
    return () => {
      window.removeEventListener("focus", load);
      clearInterval(t);
    };
  }, [dir]);

  // Confirm with a native dialog, then delete and refresh.
  const remove = async (r: Recording) => {
    const ok = await ask(`Delete "${r.name}"? This cannot be undone.`, { title: "Delete recording", kind: "warning", okLabel: "Delete" });
    if (!ok) return;
    try {
      await deleteRecording(r.path);
      load();
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <div className="flex max-h-80 flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-xs font-medium uppercase tracking-wide text-white/40">
        <span>Recordings</span>
        <button type="button" title="Open folder" onClick={() => openPath(dir)} className="rounded p-1 hover:bg-white/10 hover:text-white">
          <FolderOpen size={12} />
        </button>
      </div>
      <ul className="overflow-y-auto px-2 pb-2">
        {items.length === 0 && <li className="px-2 py-3 text-sm text-white/40">No recordings yet.</li>}
        {items.map((r) => (
          <li key={r.path} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/8">
            <span className="text-white/40">{r.kind === "video" ? <Film size={16} /> : <Image size={16} />}</span>
            <button type="button" onDoubleClick={() => openPath(r.path)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm text-white">{r.name}</div>
              <div className="text-[11px] text-white/40">
                {formatDate(r.modified)} · {formatSize(r.size)}
              </div>
            </button>
            <div className="flex gap-0.5 text-white/50 opacity-0 group-hover:opacity-100">
              <button type="button" title="Play" onClick={() => openPath(r.path)} className="rounded p-1.5 hover:bg-white/10 hover:text-white">
                <Play size={14} />
              </button>
              <button type="button" title="Show in Finder" onClick={() => revealPath(r.path)} className="rounded p-1.5 hover:bg-white/10 hover:text-white">
                <FolderOpen size={14} />
              </button>
              <button type="button" title="Delete" onClick={() => remove(r)} className="rounded p-1.5 hover:bg-red-500/20 hover:text-red-300">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
