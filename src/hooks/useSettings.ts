// Persists user settings in localStorage and fills in the default output folder.
import { useEffect, useState } from "react";
import { defaultOutputDir } from "../lib/recorder";
import { loadSettings, saveSettings, type Settings } from "../lib/settings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    if (!settings.outputDir) defaultOutputDir().then((dir) => setSettings((s) => ({ ...s, outputDir: dir })));
  }, [settings.outputDir]);

  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });

  return { settings, update };
}