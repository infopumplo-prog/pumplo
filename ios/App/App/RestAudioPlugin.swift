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

    // 16-bit signed mono PCM WAV. The whole clip carries an inaudibly quiet
    // keep-alive tone (~-58 dBFS) so the stream is non-silent (app keeps
    // background time) without an audible buzz; the beeps are written loud at the end.
    private static func composeWav(totalSeconds: Double) -> Data {
        let sr = 22050
        let total = max(1, Int(Double(sr) * totalSeconds))
        var samples = [Int16](repeating: 0, count: total)

        // Keep-alive: ~-58 dBFS, well below audible especially under music.
        let keepAmp = 40.0
        for i in 0..<total {
            samples[i] = Int16((sin(2.0 * Double.pi * 120.0 * Double(i) / Double(sr)) * keepAmp).rounded())
        }

        func writeBeep(endingAtSecondsFromEnd endGap: Double, durationMs: Double, freq: Double, vol: Double) {
            let n = Int(Double(sr) * durationMs / 1000.0)
            let endIdx = total - Int(Double(sr) * endGap)
            let startIdx = endIdx - n
            guard startIdx >= 0, endIdx <= total else { return }
            for i in 0..<n {
                let t = Double(i) / Double(sr)
                let env = i > Int(Double(n) * 0.8) ? Double(n - i) / (Double(n) * 0.2) : 1.0
                let v = sin(2.0 * Double.pi * freq * t) * env * vol * 32000.0
                samples[startIdx + i] = Int16(max(-32768.0, min(32767.0, v)))
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
        let dataLen = UInt32(samples.count * 2)
        d.append("RIFF".data(using: .ascii)!); d.append(u32(36 + dataLen)); d.append("WAVE".data(using: .ascii)!)
        d.append("fmt ".data(using: .ascii)!); d.append(u32(16)); d.append(u16(1)); d.append(u16(1))
        d.append(u32(UInt32(sr))); d.append(u32(UInt32(sr * 2))); d.append(u16(2)); d.append(u16(16))
        d.append("data".data(using: .ascii)!); d.append(u32(dataLen))
        samples.withUnsafeBufferPointer { d.append(Data(buffer: $0)) }
        return d
    }
}
