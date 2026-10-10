// Root of the main window: wires toolbar, panels and recorder together.
import { useEffect, useRef, useState } from "react";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import Toolbar from "./components/Toolbar";
import WindowPicker from "./components/WindowPicker";
import MicPicker from "./components/MicPicker";
import RecordingsPanel from "./components/RecordingsPanel";
import SettingsPanel from "./components/SettingsPanel";
import PermissionBanner from "./components/PermissionBanner";
import Notice from "./components/Notice";
import { useFitWindow } from "./hooks/useFitWindow";
import { useRecorder } from "./hooks/useRecorder";
import { useSettings } from "./hooks/useSettings";
import { useSources } from "./hooks/useSources";
import { pickArea } from "./lib/areaPicker";
import { CAMERA_TITLE, closeCamera, openCamera } from "./lib/cameraOverlay";
import type { Area, Mode, Panel } from "./lib/types";

// Owns UI state (mode, selection, open panel); recording state lives in useRecorder.
export default function App() {
  const root = useRef<HTMLDivElement>(null);
  useFitWindow(root);
  const { sources, refresh } = useSources();
  const { settings, update } = useSettings();
  const rec = useRecorder();

  const [mode, setMode] = useState<Mode>("display");
  const [windowId, setWindowId] = useState<number>();
  const [area, setArea] = useState<Area | null>(null);
  const [camera, setCamera] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const noPermission = sources?.screenPermission === false;
  const micDenied = settings.mic && sources?.micPermission === "denied";
  const mics = sources?.mics ?? [];

  // A failed recording is often a permission problem, so re-check sources.
  useEffect(() => {
    if (rec.notice?.error) refresh();
  }, [rec.notice, refresh]);

  // Switch capture mode. Window opens the picker, Area starts the drag overlay.
  const onMode = async (m: Mode) => {
    setMode(m);
    if (m === "window") {
      refresh();
      setPanel("window");
      return;
    }
    setPanel(null);
    if (m === "area") {
      const a = await pickArea();
      if (a) setArea(a);
      else if (!area) setMode("display");
    }
  };

  // Map a monitor origin (or the monitor under this window) to a ScreenCaptureKit display id.
  const displayIdFor = async (monX?: number, monY?: number) => {
    const displays = sources?.displays ?? [];
    if (monX === undefined || monY === undefined) {
      const mon = await currentMonitor();
      if (mon) {
        monX = mon.position.x / mon.scaleFactor;
        monY = mon.position.y / mon.scaleFactor;
      }
    }
    return displays.find((d) => Math.abs(d.x - (monX ?? 0)) < 2 && Math.abs(d.y - (monY ?? 0)) < 2)?.id ?? displays[0]?.id;
  };

  // Open/close the webcam overlay window.
  const toggleCamera = async () => {
    if (camera) return closeCamera();
    setCamera(true);
    await openCamera(() => setCamera(false));
  };

  // First enable picks the default mic; no mic at all opens the picker.
  const toggleMic = () => {
    if (!settings.mic && !settings.micId) {
      const first = mics[0]?.id;
      if (!first) return setPanel("mic");
      return update({ mic: true, micId: first });
    }
    update({ mic: !settings.mic });
  };

  // Stop recording and close the camera before quitting so nothing is left dangling.
  const close = async () => {
    if (rec.status !== "idle") await rec.stop();
    if (camera) await closeCamera();
    await getCurrentWindow().close();
  };

  // Build record options for the current mode and hand them to the recorder.
  const start = async () => {
    setPanel(null);
    const common = {
      fps: settings.fps,
      scale: settings.scale,
      codec: settings.codec,
      systemAudio: settings.systemAudio,
      micId: settings.mic ? settings.micId : undefined,
      keepTitles: [CAMERA_TITLE],
    };
    const dir = settings.outputDir;
    if (mode === "window") return rec.start({ mode, windowId, ...common }, dir);
    if (mode === "area" && area) {
      return rec.start({ mode, displayId: await displayIdFor(area.monitorX, area.monitorY), rect: [area.x, area.y, area.width, area.height], ...common }, dir);
    }
    return rec.start({ mode: "display", displayId: await displayIdFor(), ...common }, dir);
  };

  // Why the record button is disabled, shown as its tooltip.
  const recordDisabledReason = noPermission
    ? "Screen Recording permission required"
    : !settings.outputDir
      ? "Preparing output folder…"
      : mode === "window" && windowId === undefined
        ? "Select a window first"
        : mode === "area" && !area
          ? "Select an area first"
          : undefined;

  return (
    <div ref={root} className="flex w-fit flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 text-white">
      <Toolbar
        mode={mode}
        onMode={onMode}
        areaLabel={area && mode === "area" ? `${area.width}×${area.height}` : undefined}
        camera={camera}
        onCamera={toggleCamera}
        systemAudio={settings.systemAudio}
        onSystemAudio={() => update({ systemAudio: !settings.systemAudio })}
        mic={settings.mic}
        onMic={toggleMic}
        panel={panel}
        onPanel={setPanel}
        status={rec.status}
        pending={rec.pending}
        elapsed={rec.elapsed}
        recordDisabledReason={recordDisabledReason}
        onStart={start}
        onPause={rec.pause}
        onResume={rec.resume}
        onStop={rec.stop}
        onScreenshot={() => rec.screenshot(mode, settings.outputDir)}
        onClose={close}
      />

      {noPermission && <PermissionBanner pane="screen" onChanged={refresh} />}
      {!noPermission && micDenied && <PermissionBanner pane="microphone" onChanged={refresh} />}
      {rec.notice && <Notice {...rec.notice} />}

      {panel && (
        <div className="border-t border-white/10">
          {panel === "window" && (
            <WindowPicker windows={sources?.windows ?? []} selected={windowId} onSelect={(id) => { setWindowId(id); setPanel(null); }} onRefresh={refresh} />
          )}
          {panel === "mic" && (
            <MicPicker mics={mics} selected={settings.micId} onSelect={(micId) => { update({ mic: true, micId }); setPanel(null); }} onRefresh={refresh} />
          )}
          {panel === "recordings" && <RecordingsPanel dir={settings.outputDir} revision={rec.completed} onError={(m) => rec.say(m, true)} />}
          {panel === "settings" && <SettingsPanel settings={settings} mics={mics} onChange={update} />}
        </div>
      )}
    </div>
  );
}
