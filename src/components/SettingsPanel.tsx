// Recording preferences panel.
import { open } from "@tauri-apps/plugin-dialog";
import type { ReactNode } from "react";
import type { Settings } from "../lib/settings";
import type { MicInfo } from "../lib/types";

interface Props {
  settings: Settings;
  mics: MicInfo[];
  onChange: (patch: Partial<Settings>) => void;
}

// Label on the left, control on the right.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-white/70">{label}</span>
      {children}
    </div>
  );
}

// Small pill switch for a fixed set of options.
function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-white/5 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${value === o.value ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Stateless: every change goes straight to onChange.
export default function SettingsPanel({ settings, mics, onChange }: Props) {
  // Native folder picker for the output directory.
  const chooseDir = async () => {
    const dir = await open({ directory: true, defaultPath: settings.outputDir || undefined });
    if (typeof dir === "string") onChange({ outputDir: dir });
  };

  return (
    <div className="divide-y divide-white/5 px-4 pt-1 pb-2">
      <Row label="Save to">
        <button type="button" onClick={chooseDir} title={settings.outputDir} className="max-w-64 truncate rounded-md bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10">
          {settings.outputDir.replace(/^\/Users\/[^/]+/, "~") || "…"}
        </button>
      </Row>
      <Row label="Quality">
        <Segmented value={settings.scale} options={[{ value: 1, label: "Native" }, { value: 0.5, label: "Half" }]} onChange={(scale) => onChange({ scale })} />
      </Row>
      <Row label="Frame rate">
        <Segmented value={settings.fps} options={[{ value: 30, label: "30 fps" }, { value: 60, label: "60 fps" }]} onChange={(fps) => onChange({ fps })} />
      </Row>
      <Row label="Codec">
        <Segmented value={settings.codec} options={[{ value: "h264", label: "H.264" }, { value: "hevc", label: "HEVC" }]} onChange={(codec) => onChange({ codec })} />
      </Row>
      <Row label="System audio">
        <Segmented value={settings.systemAudio ? "on" : "off"} options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]} onChange={(v) => onChange({ systemAudio: v === "on" })} />
      </Row>
      <Row label="Microphone">
        <select
          value={settings.mic ? (settings.micId ?? "") : ""}
          onChange={(e) => onChange(e.target.value ? { mic: true, micId: e.target.value } : { mic: false })}
          className="max-w-56 rounded-md bg-white/5 px-2 py-1 text-xs text-white/80 outline-none"
        >
          <option value="">Off</option>
          {mics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Row>
    </div>
  );
}
