// Prepares the capture engine binary for the target platform before `tauri dev` / `tauri build`.
// macOS: compiles the Swift ScreenCaptureKit sidecar. Windows: downloads a static ffmpeg build.
// Tauri sets TAURI_ENV_TARGET_TRIPLE for before-commands; falls back to the host triple.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const triple = process.env.TAURI_ENV_TARGET_TRIPLE ?? execSync("rustc -vV").toString().match(/host: (\S+)/)[1];
const dir = "src-tauri/binaries";
mkdirSync(dir, { recursive: true });

if (triple.includes("apple-darwin")) {
  const arch = triple.startsWith("aarch64") ? "arm64" : "x86_64";
  run(
    `swiftc -O -target ${arch}-apple-macos15.0 -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker src-tauri/sidecar/Info.plist ` +
      `src-tauri/sidecar/recorder.swift -o ${dir}/recorder-${triple}`,
  );
} else if (triple.includes("windows")) {
  const out = `${dir}/ffmpeg-${triple}.exe`;
  if (existsSync(out)) {
    console.log(`ffmpeg already present: ${out}`);
  } else {
    const url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
    const zip = `${dir}/ffmpeg-win64.zip`;
    console.log(`Downloading ${url}`);
    run(`curl -L --fail -o "${zip}" "${url}"`);
    run(`unzip -o -j "${zip}" "*/bin/ffmpeg.exe" -d "${dir}"`);
    renameSync(`${dir}/ffmpeg.exe`, out);
    rmSync(zip);
  }
} else {
  console.error(`Unsupported target: ${triple}`);
  process.exit(1);
}
