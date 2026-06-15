import Foundation
import Capacitor
import AVFoundation

// Native rest-timer audio. Plays ONE composed clip = (near-)silence for the whole
// rest, with the 3-2-1 countdown + final beep baked in at the end. Because audio
// is actively playing the entire rest, iOS keeps the app alive in the background
// (UIBackgroundModes: audio), so the beep is heard even with the phone locked and
// headphones in. The session uses .mixWithOthers so Spotify/music keeps playing.
@objc(RestAudioPlugin)
public class RestAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestAudioPlugin"
    public let jsName = "RestAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVAudioPlayer?

    @objc func start(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds") ?? 0
        guard seconds > 0 else { call.resolve(); return }

        DispatchQueue.global(qos: .userInitiated).async {
            let data = RestAudioPlugin.composeWav(totalSeconds: seconds)
            DispatchQueue.main.async {
                do {
                    let session = AVAudioSession.sharedInstance()
                    try session.setCategory(.playback, options: [.mixWithOthers])
                    try session.setActive(true)
                    self.player?.stop()
                    let p = try AVAudioPlayer(data: data)
                    p.prepareToPlay()
                    p.play()
                    self.player = p
                    call.resolve()
                } catch {
                    call.reject("rest audio start failed: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        player?.stop()
        player = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        call.resolve()
    }

    // 8-bit unsigned mono PCM WAV: 128 = silence; beeps written near the end.
    private static func composeWav(totalSeconds: Double) -> Data {
        let sr = 22050
        let total = max(1, Int(Double(sr) * totalSeconds))
        var samples = [UInt8](repeating: 128, count: total)

        func writeBeep(endingAtSecondsFromEnd endGap: Double, durationMs: Double, freq: Double, vol: Double) {
            let n = Int(Double(sr) * durationMs / 1000.0)
            let endIdx = total - Int(Double(sr) * endGap)
            let startIdx = endIdx - n
            guard startIdx >= 0, endIdx <= total else { return }
            for i in 0..<n {
                let t = Double(i) / Double(sr)
                let env = i > Int(Double(n) * 0.8) ? Double(n - i) / (Double(n) * 0.2) : 1.0
                let v = sin(2.0 * Double.pi * freq * t) * env * vol
                samples[startIdx + i] = UInt8(max(0, min(255, Int((v * 0.5 + 0.5) * 255.0))))
            }
        }

        // Countdown beeps end at 3s/2s/1s before rest end; final beep ends exactly at 0.
        writeBeep(endingAtSecondsFromEnd: 3, durationMs: 120, freq: 880, vol: 0.7)
        writeBeep(endingAtSecondsFromEnd: 2, durationMs: 120, freq: 880, vol: 0.7)
        writeBeep(endingAtSecondsFromEnd: 1, durationMs: 120, freq: 880, vol: 0.7)
        writeBeep(endingAtSecondsFromEnd: 0, durationMs: 450, freq: 1175, vol: 0.95)

        var d = Data()
        func u32(_ v: UInt32) -> Data { var x = v.littleEndian; return Data(bytes: &x, count: 4) }
        func u16(_ v: UInt16) -> Data { var x = v.littleEndian; return Data(bytes: &x, count: 2) }
        let dataLen = UInt32(samples.count)
        d.append("RIFF".data(using: .ascii)!); d.append(u32(36 + dataLen)); d.append("WAVE".data(using: .ascii)!)
        d.append("fmt ".data(using: .ascii)!); d.append(u32(16)); d.append(u16(1)); d.append(u16(1))
        d.append(u32(UInt32(sr))); d.append(u32(UInt32(sr))); d.append(u16(1)); d.append(u16(8))
        d.append("data".data(using: .ascii)!); d.append(u32(dataLen)); d.append(Data(samples))
        return d
    }
}
