// Recording state machine: start/pause/resume/stop, elapsed timer, screenshots, and status notices.
import { useEffect, useRef, useState } from "react";
import { onRecordingEvent, outputFile, pauseRecording, resumeRecording, startRecording, stopRecording, takeScreenshot } from "../lib/recorder";
import type { CaptureTarget, Mode, RecordOptions } from "../lib/types";

export type RecStatus = "idle" | "starting" | "recording" | "paused" | "stopping";

export function useRecorder() {
  const [status, setStatus] = useState<RecStatus>("idle");
  const [pending, setPending] = useState(false);
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
      setPending(false);
      switch (e.event) {
        case "paused":
          setStatus("paused");
          break;
        case "resumed":
          setStatus("recording");
          break;
        case "stopped":
          say(`Saved ${e.path.split("/").pop()}`);
          setCompleted((n) => n + 1);
          setStatus("idle");
          break;
        case "error":
          say(e.message, true);
          setStatus((s) => (e.path ? "idle" : s));
          break;
        case "exited":
          setStatus("idle");
          break;
      }
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const start = async (opts: Omit<RecordOptions, "output">, dir: string) => {
    setStatus("starting");
    setElapsed(0);
    try {
      await startRecording({ ...opts, output: outputFile(dir, "Tix Recording", "mp4") });
      setStatus("recording");
    } catch (e) {
      say(String(e), true);
      setStatus("idle");
    }
  };

  const send = async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
    } catch (e) {
      say(String(e), true);
      setPending(false);
    }
  };

  const pause = () => send(pauseRecording);
  const resume = () => send(resumeRecording);

  const stop = async () => {
    setStatus("stopping");
    try {
      await stopRecording();
      window.setTimeout(() => {
        setStatus((s) => {
          if (s === "stopping") say("Recorder did not respond. The file may be incomplete.", true);
          return s === "stopping" ? "idle" : s;
        });
      }, 60000);
    } catch (e) {
      say(String(e), true);
      setStatus("idle");
    }
  };

  const screenshot = async (mode: Mode, dir: string, target: CaptureTarget = {}) => {
    try {
      const path = await takeScreenshot(mode, outputFile(dir, "Tix Shot", "png"), target);
      if (path) {
        say(`Saved ${path.split("/").pop()}`);
        setCompleted((n) => n + 1);
      }
    } catch (e) {
      say(String(e), true);
    }
  };

  return { status, pending, elapsed, notice, completed, say, start, pause, resume, stop, screenshot };
}
