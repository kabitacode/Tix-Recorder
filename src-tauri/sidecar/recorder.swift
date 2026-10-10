import AppKit
import AVFoundation
import CoreGraphics
import Foundation
import ScreenCaptureKit

func emit(_ obj: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: obj)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

func fail(_ msg: String) -> Never {
    emit(["event": "error", "message": msg])
    exit(1)
}

struct Options: Decodable {
    var mode: String
    var displayId: UInt32?
    var windowId: UInt32?
    var rect: [Double]?
    var output: String
    var fps: Int?
    var scale: Double?
    var codec: String?
    var systemAudio: Bool?
    var micId: String?
    var keepTitles: [String]?
}

func parentWindows(_ content: SCShareableContent, keep: [String]) -> [SCWindow] {
    let ppid = getppid()
    return content.windows.filter {
        $0.owningApplication?.processID == ppid && !keep.contains($0.title ?? "")
    }
}

func authStatus(_ media: AVMediaType) -> String {
    switch AVCaptureDevice.authorizationStatus(for: media) {
    case .authorized: return "authorized"
    case .notDetermined: return "notDetermined"
    default: return "denied"
    }
}

func listAll() async {
    let screen = CGPreflightScreenCaptureAccess()
    var out: [String: Any] = ["screenPermission": screen]
    if screen, let content = try? await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true) {
        let ppid = getppid()
        out["displays"] = content.displays.map {
            ["id": $0.displayID, "x": $0.frame.origin.x, "y": $0.frame.origin.y,
             "width": $0.frame.width, "height": $0.frame.height]
        }
        out["windows"] = content.windows
            .filter {
                $0.windowLayer == 0 && !($0.title ?? "").isEmpty && $0.frame.width > 80
                    && $0.frame.height > 60 && $0.owningApplication?.processID != ppid
            }
            .map {
                ["id": $0.windowID, "title": $0.title ?? "",
                 "app": $0.owningApplication?.applicationName ?? ""]
            }
    }
    out["mics"] = AVCaptureDevice.DiscoverySession(
        deviceTypes: [.microphone, .external], mediaType: .audio, position: .unspecified
    ).devices.map { ["id": $0.uniqueID, "name": $0.localizedName] }
    out["micPermission"] = authStatus(.audio)
    emit(out)
}

final class Recorder: NSObject, SCStreamDelegate, SCRecordingOutputDelegate {
    var stream: SCStream?
    var output: SCRecordingOutput?
    var path = ""
    var done: CheckedContinuation<String?, Never>?
    var stopping = false

    func start(_ o: Options) async throws {
        let keep = o.keepTitles ?? []
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let cfg = SCStreamConfiguration()
        let filter: SCContentFilter
        var size: CGSize
        if o.mode == "window" {
            guard let w = content.windows.first(where: { $0.windowID == o.windowId }) else {
                throw NSError(domain: "rec", code: 1, userInfo: [NSLocalizedDescriptionKey: "Window not found"])
            }
            filter = SCContentFilter(desktopIndependentWindow: w)
            size = w.frame.size
        } else {
            guard let d = content.displays.first(where: { $0.displayID == o.displayId }) ?? content.displays.first else {
                throw NSError(domain: "rec", code: 2, userInfo: [NSLocalizedDescriptionKey: "Display not found"])
            }
            filter = SCContentFilter(display: d, excludingWindows: parentWindows(content, keep: keep))
            size = d.frame.size
            if o.mode == "area", let r = o.rect, r.count == 4 {
                cfg.sourceRect = CGRect(x: r[0], y: r[1], width: r[2], height: r[3])
                size = cfg.sourceRect.size
            }
        }
        let scale = Double(filter.pointPixelScale) * (o.scale ?? 1)
        cfg.width = max(2, Int(size.width * scale) / 2 * 2)
        cfg.height = max(2, Int(size.height * scale) / 2 * 2)
        cfg.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(o.fps ?? 60))
        cfg.showsCursor = true
        cfg.capturesAudio = o.systemAudio ?? false
        cfg.excludesCurrentProcessAudio = true
        if let mic = o.micId {
            if AVCaptureDevice.authorizationStatus(for: .audio) == .notDetermined {
                _ = await AVCaptureDevice.requestAccess(for: .audio)
            }
            guard authStatus(.audio) != "denied" else {
                throw NSError(domain: "rec", code: 3, userInfo: [NSLocalizedDescriptionKey: "Microphone permission denied"])
            }
            cfg.captureMicrophone = true
            cfg.microphoneCaptureDeviceID = mic
        }

        let rc = SCRecordingOutputConfiguration()
        path = o.output
        rc.outputURL = URL(fileURLWithPath: path)
        rc.outputFileType = .mp4
        rc.videoCodecType = o.codec == "hevc" ? .hevc : .h264
        let out = SCRecordingOutput(configuration: rc, delegate: self)
        let s = SCStream(filter: filter, configuration: cfg, delegate: self)
        try s.addRecordingOutput(out)
        try await s.startCapture()
        stream = s
        output = out
    }

    func stop() async {
        if stopping { return }
        stopping = true
        let err: String? = await withCheckedContinuation { c in
            done = c
            Task {
                try? await Task.sleep(for: .seconds(10))
                finish("Timed out while finalizing the recording")
            }
            Task {
                do {
                    try await stream?.stopCapture()
                } catch {
                    finish(error.localizedDescription)
                }
            }
        }
        if let err { emit(["event": "error", "message": err, "path": path]) } else {
            emit(["event": "stopped", "path": path])
        }
        exit(err == nil ? 0 : 1)
    }

    func finish(_ err: String?) {
        done?.resume(returning: err)
        done = nil
    }

    func recordingOutputDidFinishRecording(_ o: SCRecordingOutput) { finish(nil) }
    func recordingOutput(_ o: SCRecordingOutput, didFailWithError e: Error) { finish(e.localizedDescription) }
    func stream(_ s: SCStream, didStopWithError e: Error) {
        if stopping { finish(e.localizedDescription) } else {
            emit(["event": "error", "message": e.localizedDescription, "path": path])
            exit(1)
        }
    }
}

NSApplication.shared.setActivationPolicy(.prohibited)
_ = CGMainDisplayID()
let args = CommandLine.arguments
switch args.count > 1 ? args[1] : "" {
case "list":
    await listAll()
    exit(0)
case "request":
    let screen = CGRequestScreenCaptureAccess()
    _ = await AVCaptureDevice.requestAccess(for: .audio)
    emit(["screenPermission": screen, "micPermission": authStatus(.audio)])
    exit(0)
case "record":
    guard args.count > 2, let data = args[2].data(using: .utf8),
        let opts = try? JSONDecoder().decode(Options.self, from: data)
    else { fail("Bad options JSON") }
    let rec = Recorder()
    do { try await rec.start(opts) } catch { fail(error.localizedDescription) }
    emit(["event": "started", "path": opts.output])
    DispatchQueue.global().async {
        while let line = readLine() {
            if line.trimmingCharacters(in: .whitespacesAndNewlines) == "stop" { break }
        }
        Task { await rec.stop() }
    }
    while true { try? await Task.sleep(for: .seconds(3600)) }
default:
    fail("Usage: recorder list|request|record <json>")
}
