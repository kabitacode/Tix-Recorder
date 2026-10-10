// Window list panel for Window mode.
import { RefreshCw } from "lucide-react";
import type { WindowInfo } from "../lib/types";

interface Props {
  windows: WindowInfo[];
  selected?: number;
  onSelect: (id: number) => void;
  onRefresh: () => void;
}

// Shows title + app for each capturable window; refresh re-queries the sidecar.
export default function WindowPicker({ windows, selected, onSelect, onRefresh }: Props) {
  return (
    <div className="flex max-h-72 flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-xs font-medium uppercase tracking-wide text-white/40">
        <span>Choose a window</span>
        <button type="button" title="Refresh" onClick={onRefresh} className="rounded p-1 hover:bg-white/10 hover:text-white">
          <RefreshCw size={12} />
        </button>
      </div>
      <ul className="overflow-y-auto px-2 pb-2">
        {windows.length === 0 && <li className="px-2 py-3 text-sm text-white/40">No windows found.</li>}
        {windows.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onSelect(w.id)}
              className={`flex w-full flex-col items-start rounded-lg px-2 py-1.5 text-left hover:bg-white/8 ${selected === w.id ? "bg-white/15" : ""}`}
            >
              <span className="w-full truncate text-sm text-white">{w.title}</span>
              <span className="text-[11px] text-white/40">{w.app}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
