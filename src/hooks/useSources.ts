// Loads displays, windows, mics, and permission status from the sidecar; polls while blocked.
import { useCallback, useEffect, useState } from "react";
import { listSources } from "../lib/recorder";
import type { Sources } from "../lib/types";

export function useSources() {
  const [sources, setSources] = useState<Sources | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSources(await listSources());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const blocked = sources?.screenPermission === false || sources?.micPermission === "denied";
  useEffect(() => {
    if (!blocked) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [blocked, refresh]);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  return { sources, error, refresh };
}