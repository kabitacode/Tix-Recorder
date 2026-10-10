// Microphone list panel.
import { Check, RefreshCw } from "lucide-react";
import type { MicInfo } from "../lib/types";

interface Props {
  mics: MicInfo[];
  selected?: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

// Renders mics with a check on the selected one; refresh re-queries the sidecar.
export default function MicPicker({ mics, selected, onSelect, onRefresh }: Props) {
  return (
    <div className="flex max-h-72 flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-xs font-medium uppercase tracking-wide text-white/40">
        <span>Microphone</span>
        <button type="button" title="Refresh" onClick={onRefresh} className="rounded p-1 hover:bg-white/10 hover:text-white">
          <RefreshCw size={12} />
        </button>
      </div>
      <ul className="overflow-y-auto px-2 pb-2">
        {mics.length === 0 && <li className="px-2 py-3 text-sm text-white/40">No microphones found.</li>}
        {mics.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/8 ${selected === m.id ? "bg-white/15 text-white" : "text-white/80"}`}
            >
              <span className="flex-1 truncate">{m.name}</span>
              {selected === m.id && <Check size={14} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
