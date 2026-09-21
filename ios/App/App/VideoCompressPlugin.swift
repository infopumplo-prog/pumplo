import Foundation
import Capacitor
import AVFoundation

// Komprese videa vlastního cviku před uploadem: přepis na H.264 mp4 do 1280×720
// (na výšku 720×1280), bez zvukové stopy (přehrávače v appce jsou muted),
// s limitem velikosti odvozeným z požadovaného bitrate × délka.
// Vstup: file:// cesta (Filesystem.getUri z Directory.Cache). Výstup: file:// v tmp.
@objc(VideoCompressPlugin)
public class VideoCompressPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VideoCompressPlugin"
    public let jsName = "VideoCompress"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "compress", returnType: CAPPluginReturnPromise)
    ]

    @objc func compress(_ call: CAPPluginCall) {
        guard let pathStr = call.getString("path") else { call.reject("path missing"); return }
        let bitrate = Double(call.getInt("bitrate") ?? 2_000_000)
        let inputURL: URL = pathStr.hasPrefix("file://") ? (URL(string: pathStr) ?? URL(fileURLWithPath: pathStr)) : URL(fileURLWithPath: pathStr)

        let asset = AVURLAsset(url: inputURL)
        guard let videoTrack = asset.tracks(withMediaType: .video).first else { call.reject("no video track"); return }

        // Jen video stopa (bez audia) — menší soubor, přehrávač zvuk stejně nepoužívá.
        let composition = AVMutableComposition()
        guard let compTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            call.reject("composition failed"); return
        }
        do {
            try compTrack.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: videoTrack, at: .zero)
        } catch {
            call.reject("insert failed: \(error.localizedDescription)"); return
        }
        compTrack.preferredTransform = videoTrack.preferredTransform

        guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPreset1280x720) else {
            call.reject("export session unavailable"); return
        }
        let outURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("compress-out-\(Int(Date().timeIntervalSince1970 * 1000)).mp4")
        try? FileManager.default.removeItem(at: outURL)
        export.outputURL = outURL
        export.outputFileType = .mp4
        export.shouldOptimizeForNetworkUse = true
        let seconds = max(1.0, CMTimeGetSeconds(asset.duration))
        // Horní mez velikosti: bitrate × délka (+20 % rezerva na hlavičky a klíčové snímky).
        export.fileLengthLimit = Int64(bitrate / 8.0 * seconds * 1.2)

        export.exportAsynchronously {
            switch export.status {
            case .completed:
                let size = (try? FileManager.default.attributesOfItem(atPath: outURL.path)[.size] as? NSNumber)?.int64Value ?? 0
                call.resolve(["path": outURL.absoluteString, "size": size])
            case .cancelled:
                call.reject("export cancelled")
            default:
                call.reject("export failed: \(export.error?.localizedDescription ?? "unknown")")
            }
        }
    }
}
