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

func err(_ msg: String) -> NSError {
    NSError(domain: "rec", code: 1, userInfo: [NSLocalizedDescriptionKey: msg])
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

// Joins finished segment files into one mp4 without re-encoding.
func concat(_ urls: [URL], to dest: URL) async throws {
    let comp = AVMutableComposition()
    var byType: [AVMediaType: [AVMutableCompositionTrack]] = [:]
    var cursor = CMTime.zero
    for url in urls {
        let asset = AVURLAsset(url: url)
        let tracks = try await asset.load(.tracks)
        var index: [AVMediaType: Int] = [:]
        var longest = CMTime.zero
        for track in tracks {
            let range = try await track.load(.timeRange)
            let i = index[track.mediaType, default: 0]
            index[track.mediaType] = i + 1
            var list = byType[track.mediaType] ?? []
            if list.count <= i {
                guard let t = comp.addMutableTrack(withMediaType: track.mediaType, preferredTrackID: kCMPersistentTrackID_Invalid) else {
                    throw err("Cannot build composition track")
                }
                list.append(t)
                byType[track.mediaType] = list
            }
            try list[i].insertTimeRange(range, of: track, at: cursor)
            longest = CMTimeMaximum(longest, range.duration)
        }
        cursor = cursor + longest
    }
    guard let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else {
        throw err("Cannot create export session")
    }
    try await export.export(to: dest, as: .mp4)
}

final class Recorder: NSObject, SCStreamDelegate, SCRecordingOutputDelegate {
    var stream: SCStream?
    var output: SCRecordingOutput?
    var codec: AVVideoCodecType = .h264
    var finalPath = ""
    var segments: [URL] = []
    var paused = false
    var stopping = false
    private let lock = NSLock()
    private var segmentDone: CheckedContinuation<String?, Never>?

    func start(_ o: Options) async throws {
        let keep = o.keepTitles ?? []
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let cfg = SCStreamConfiguration()
        let filter: SCContentFilter
        var size: CGSize
        if o.mode == "window" {
            guard let w = content.windows.first(where: { $0.windowID == o.windowId }) else { throw err("Window not found") }
            filter = SCContentFilter(desktopIndependentWindow: w)
            size = w.frame.size
        } else {
            guard let d = content.displays.first(where: { $0.displayID == o.displayId }) ?? content.displays.first else {
                throw err("Display not found")
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
            guard authStatus(.audio) != "denied" else { throw err("Microphone permission denied") }
            cfg.captureMicrophone = true
            cfg.microphoneCaptureDeviceID = mic
        }

        codec = o.codec == "hevc" ? .hevc : .h264
        finalPath = o.output
        let s = SCStream(filter: filter, configuration: cfg, delegate: self)
        stream = s
        try beginSegment()
        try await s.startCapture()
    }

    private func beginSegment() throws {
        guard let s = stream else { throw err("Stream not running") }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("tix-\(ProcessInfo.processInfo.processIdentifier)-\(segments.count).mp4")
        let rc = SCRecordingOutputConfiguration()
        rc.outputURL = url
        rc.outputFileType = .mp4
        rc.videoCodecType = codec
        let out = SCRecordingOutput(configuration: rc, delegate: self)
        try s.addRecordingOutput(out)
        output = out
        segments.append(url)
    }

    private func endSegment() async -> String? {
        guard let out = output, let s = stream else { return nil }
        output = nil
        return await withCheckedContinuation { c in
            lock.lock()
            segmentDone = c
            lock.unlock()
            Task {
                try? await Task.sleep(for: .seconds(10))
                self.finishSegment("Timed out while finalizing the recording")
            }
            do {
                try s.removeRecordingOutput(out)
            } catch {
                finishSegment(error.localizedDescription)
            }
        }
    }

    private func finishSegment(_ error: String?) {
        lock.lock()
        let c = segmentDone
        segmentDone = nil
        lock.unlock()
        c?.resume(returning: error)
    }

    func pause() async {
        guard !paused, !stopping else { return }
        if let e = await endSegment() { emit(["event": "error", "message": e]) }
        paused = true
        emit(["event": "paused"])
    }

    func resume() {
        guard paused, !stopping else { return }
        do {
            try beginSegment()
            paused = false
            emit(["event": "resumed"])
        } catch {
            emit(["event": "error", "message": error.localizedDescription])
        }
    }

    func stop() async {
        guard !stopping else { return }
        stopping = true
        var problem: String? = nil
        if !paused { problem = await endSegment() }
        try? await stream?.stopCapture()
        await finalize(problem)
    }

    private func finalize(_ problem: String?) async {
        var error = problem
        let dest = URL(fileURLWithPath: finalPath)
        let existing = segments.filter { FileManager.default.fileExists(atPath: $0.path) }
        do {
            if existing.isEmpty {
                throw err("No video data was recorded")
            } else if existing.count == 1 {
                try? FileManager.default.removeItem(at: dest)
                try FileManager.default.moveItem(at: existing[0], to: dest)
            } else {
                try? FileManager.default.removeItem(at: dest)
                try await concat(existing, to: dest)
            }
        } catch let e {
            error = error ?? e.localizedDescription
        }
        for url in existing where url != dest { try? FileManager.default.removeItem(at: url) }
        if let error {
            emit(["event": "error", "message": error, "path": finalPath])
            exit(1)
        }
        emit(["event": "stopped", "path": finalPath])
        exit(0)
    }

    func recordingOutputDidFinishRecording(_ o: SCRecordingOutput) { finishSegment(nil) }
    func recordingOutput(_ o: SCRecordingOutput, didFailWithError e: Error) { finishSegment(e.localizedDescription) }
    func stream(_ s: SCStream, didStopWithError e: Error) {
        if stopping {
            finishSegment(e.localizedDescription)
        } else {
            stopping = true
            Task { await self.finalize(e.localizedDescription) }
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
    let commands = AsyncStream<String> { cont in
        DispatchQueue.global().async {
            while let line = readLine() {
                cont.yield(line.trimmingCharacters(in: .whitespacesAndNewlines))
            }
            cont.yield("stop")
            cont.finish()
        }
    }
    for await cmd in commands {
        switch cmd {
        case "pause": await rec.pause()
        case "resume": rec.resume()
        case "stop": await rec.stop()
        default: break
        }
    }
    while true { try? await Task.sleep(for: .seconds(3600)) }
default:
    fail("Usage: recorder list|request|record <json>")
}
