// Recording state machine: start/stop, elapsed timer, screenshots, and status notices.
import { useEffect, useRef, useState } from "react";
import { onRecordingEvent, outputFile, startRecording, stopRecording, takeScreenshot } from "../lib/recorder";
import type { Mode, RecordOptions } from "../lib/types";

export type RecStatus = "idle" | "starting" | "recording" | "stopping";

export function useRecorder() {
  const [status, setStatus] = useState<RecStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [completed, setCompleted] = useState(0);
  const noticeTimer = useRef<number | undefined>(undefined);

  const say = (text: string, error = false) => {
    setNotice({ text, error });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), error ? 6000 : 3500);
  };

  useEffect(() => {
    const un = onRecordingEvent((e) => {
      if (e.event === "stopped") {
        say(`Saved ${e.path.split("/").pop()}`);
        setCompleted((n) => n + 1);
      } else if (e.event === "error") {
        say(e.message, true);
      }
      if (e.event !== "exited") setStatus("idle");
      else setStatus((s) => (s === "recording" ? "idle" : s));
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const start = async (opts: Omit<RecordOptions, "output">, dir: string) => {
    setStatus("starting");
    try {
      await startRecording({ ...opts, output: outputFile(dir, "Tix Recording", "mp4") });
      setStatus("recording");
    } catch (e) {
      say(String(e), true);
      setStatus("idle");
    }
  };

  const stop = async () => {
    setStatus("stopping");
    try {
      await stopRecording();
      window.setTimeout(() => {
        setStatus((s) => {
          if (s === "stopping") say("Recorder did not respond. The file may be incomplete.", true);
          return s === "stopping" ? "idle" : s;
        });
      }, 15000);
    } catch (e) {
      say(String(e), true);
      setStatus("idle");
    }
  };

  const screenshot = async (mode: Mode, dir: string) => {
    try {
      const path = await takeScreenshot(mode, outputFile(dir, "Tix Shot", "png"));
      if (path) {
        say(`Saved ${path.split("/").pop()}`);
        setCompleted((n) => n + 1);
      }
    } catch (e) {
      say(String(e), true);
    }
  };

  return { status, elapsed, notice, completed, say, start, stop, screenshot };
}