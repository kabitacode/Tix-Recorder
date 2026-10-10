# Tix Recorder

A compact, floating screen-recorder toolbar for macOS. Built with Tauri 2, React and Tailwind, with a small Swift sidecar on top of ScreenCaptureKit for capture.

## Features

- **Display, Window and Area recording** to MP4 (H.264 or HEVC).
- **Screenshots** of the full screen, a window or a selected area (PNG).
- **System audio** and **microphone** capture, with microphone selection.
- **Camera overlay** window that is captured together with the screen in Display and Area modes.
- **Recordings panel**: open, reveal in Finder and delete saved files.
- **Settings**: output folder, quality (native or half resolution), frame rate (30 or 60 fps), codec and audio sources.
- Always-on-top, translucent toolbar that stays out of the way while recording.

## Requirements

- macOS 15 (Sequoia) or newer. Recording uses `SCRecordingOutput`, which is not available on older systems.
- To build from source: [Bun](https://bun.sh), [Rust](https://rustup.rs) and the Xcode Command Line Tools (`xcode-select --install`, needed for `swiftc`).

## Install

Download the latest `.dmg` from the [Releases](../../releases) page, open it and drag Tix Recorder to Applications.

Release builds are not signed with a Developer ID yet, so Gatekeeper blocks the first launch. Run this once after copying the app:

```sh
xattr -cr "/Applications/Tix Recorder.app"
```

## Windows build (from macOS, cross-compiled)

```sh
brew install nsis llvm
export PATH="$(brew --prefix llvm)/bin:$PATH"
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
bun tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

Output: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Tix Recorder_<version>_x64-setup.exe`.

## Permissions

| Permission       | When                       | Notes                                                      |
| ---------------- | -------------------------- | ---------------------------------------------------------- |
| Screen Recording | Required at launch         | The toolbar shows a banner with a link to System Settings. Relaunch after granting. |
| Microphone       | First time you enable mic  | Requested by the capture sidecar.                          |
| Camera           | First time you enable the overlay | Requested by the capture sidecar.                    |

## Build from source

```sh
git clone <repo-url>
cd tix-recorder
bun install
bun tauri dev      # development
bun tauri build    # release bundle
```

`bun run sidecar` compiles `src-tauri/sidecar/recorder.swift` into `src-tauri/binaries/` and runs automatically before `dev` and `build`.

Release output: `src-tauri/target/release/bundle/macos/Tix Recorder.app` and a `.dmg` under `bundle/dmg/`.

The sidecar is compiled for the host CPU only. For a universal binary, compile it for both `aarch64-apple-darwin` and `x86_64-apple-darwin`, merge with `lipo`, then run `bun tauri build --target universal-apple-darwin`.

To sign a build, set `signingIdentity` in `src-tauri/tauri.conf.json`. Entitlements live in `src-tauri/Entitlements.plist`.

## How it works

```
React toolbar (webview)
   │  invoke()
   ▼
Rust (Tauri commands)  ──spawn──▶  recorder (Swift sidecar, ScreenCaptureKit)
   │                                   │  JSON lines over stdout
   └── recording-event ◀───────────────┘
```

- The Rust side spawns the sidecar once per recording, forwards its JSON events to the webview and sends `stop` over stdin to finish.
- Screenshots use the system `screencapture` tool.
- Settings are stored in `localStorage`; recordings default to `~/Movies/Tix Recorder`.

## Project layout

```
src/components        toolbar, pickers, panels
src/hooks             useRecorder, useSources, useSettings, useFitWindow
src/lib               invoke wrappers, settings, types
src/windows           AreaPicker, CameraOverlay (separate webview windows)
src-tauri/src         sidecar spawn, recording state, screenshot, recordings, paths
src-tauri/sidecar     recorder.swift: `list` | `request` | `record <json>`
.github/workflows     release build on `v*` tags
```

## Limitations

- The camera overlay is captured only in Display and Area modes, not in Window mode.
- Windows: no system audio (ffmpeg has no WASAPI loopback), GDI capture is CPU-bound, window capture matches by title so a renamed window must be picked again. Untested on real hardware until a Windows machine runs the installer.
- Linux is not supported.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
