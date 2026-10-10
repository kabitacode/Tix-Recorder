// Webcam bubble in its own always-on-top window.
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openPrivacySettings } from "../lib/recorder";

// Shows the camera feed, or an error with a shortcut to Privacy settings.
export default function CameraOverlay() {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Open the camera on mount, stop it on unmount. Esc closes the window.
  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 640, facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch((e: Error) => setError(e.message));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && getCurrentWindow().close();
    window.addEventListener("keydown", onKey);
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div data-tauri-drag-region className="h-screen w-screen p-2">
      <div data-tauri-drag-region className="h-full w-full overflow-hidden rounded-full border-2 border-white/20 bg-neutral-900 shadow-2xl shadow-black/60">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-red-300">
            <span>{error}</span>
            <button type="button" onClick={() => openPrivacySettings("camera")} className="rounded-md bg-white/10 px-2 py-1 text-white hover:bg-white/20">
              Open Settings
            </button>
          </div>
        ) : (
          <video ref={video} autoPlay muted playsInline className="pointer-events-none h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
        )}
      </div>
    </div>
  );
}
