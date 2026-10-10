// Status line under the toolbar.
import { AlertCircle, Check } from "lucide-react";

// Red with alert icon on error, otherwise muted with a check.
export default function Notice({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={`flex items-center gap-2 border-t border-white/10 px-4 py-2 text-xs ${error ? "text-red-300" : "text-white/70"}`}>
      {error ? <AlertCircle size={14} /> : <Check size={14} />}
      <span className="truncate">{text}</span>
    </div>
  );
}
