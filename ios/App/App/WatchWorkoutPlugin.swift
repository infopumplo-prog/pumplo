import Foundation
import Capacitor
import WatchConnectivity

// Most na companion watch appku. Web posílá po každé změně tréninku nejnovější
// snapshot, hodinky posílají zpět akce. Všechno je best-effort: nespárované
// hodinky ani chybějící watch app nesmí v JS vyvolat chybu (stejný kontrakt
// jako RestActivityPlugin).
//
// updateApplicationContext drží jen POSLEDNÍ hodnotu (přesně to chceme —
// nejnovější snapshot přebije starší), sendMessage doručí urgentní přechod
// (start pauzy, ±15 s, konec tréninku) hned, když jsou hodinky dosažitelné.
@objc(WatchWorkoutPlugin)
public class WatchWorkoutPlugin: CAPPlugin, CAPBridgedPlugin {
    // Bez konformity k CAPBridgedPlugin by bridge registraci instance odmítl
    // ("must conform to CAPBridgedPlugin") a plugin by v JS neexistoval.
    public let identifier = "WatchWorkoutPlugin"
    public let jsName = "WatchWorkout"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endState", returnType: CAPPluginReturnPromise)
    ]

    // Pořadové číslo snapshotu. Startuje na wall-clocku, takže po restartu
    // aplikace nikdy neklesne pod hodnotu, kterou hodinky už viděly.
    private var seq: Double = Date().timeIntervalSince1970 * 1000
    private var lastSnapshot: [String: Any]?

    public override func load() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    @objc func updateState(_ call: CAPPluginCall) {
        let raw = (call.options as? [String: Any]) ?? [:]
        push(snapshot: WatchPayload.sanitize(raw))
        call.resolve()
    }

    @objc func endState(_ call: CAPPluginCall) {
        push(snapshot: ["phase": "idle", "resting": false])
        lastSnapshot = nil
        call.resolve()
    }

    private func push(snapshot: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        seq += 1
        var payload = snapshot
        payload["seq"] = seq
        let urgent = WatchPayload.isUrgent(previous: lastSnapshot, next: payload)
        lastSnapshot = payload

        do {
            try session.updateApplicationContext(payload)
        } catch {
            // Nespárované hodinky / watch app není nainstalovaná → noop.
        }
        if urgent && session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
                // Hodinky mezitím usnuly — applicationContext stejně dorazí.
            })
        }
    }
}

extension WatchWorkoutPlugin: WCSessionDelegate {
    public func session(_ session: WCSession,
                        activationDidCompleteWith activationState: WCSessionActivationState,
                        error: Error?) {}

    public func sessionDidBecomeInactive(_ session: WCSession) {}

    // Uživatel přepnul na jiné hodinky — session se musí aktivovat znovu.
    public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let action = WatchPayload.action(from: message) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("watchAction", data: action)
        }
    }

    // Když je telefon nedosažitelný, hodinky akci zařadí do fronty
    // (transferUserInfo) — doručí se sem, jakmile spojení naskočí.
    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let action = WatchPayload.action(from: userInfo) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("watchAction", data: action)
        }
    }
}
