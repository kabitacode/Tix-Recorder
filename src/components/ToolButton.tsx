// Generic toolbar button.
import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label?: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

// Icon with optional small label; active = highlighted background.
export default function ToolButton({ icon, label, title, active, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] leading-none transition-colors
        ${active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/8 hover:text-white"}
        disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
