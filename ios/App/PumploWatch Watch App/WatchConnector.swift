import Foundation
import WatchConnectivity

// Příjem stavu z telefonu a odesílání akcí zpět. Stav chodí dvěma cestami
// (applicationContext + přímá zpráva u urgentních přechodů), takže se může
// zopakovat nebo dorazit na přeskáčku — rozhoduje seq, starší se zahodí.
final class WatchConnector: NSObject, ObservableObject {
    @Published private(set) var snapshot: WatchWorkoutSnapshot = .idle
    @Published private(set) var hasSnapshot = false

    private var lastSeq: Double = -1

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func send(action: String, weight: Double? = nil, reps: Int? = nil) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        var message: [String: Any] = ["type": action]
        if let weight { message["weight"] = weight }
        if let reps { message["reps"] = reps }

        if session.isReachable {
            session.sendMessage(message, replyHandler: nil, errorHandler: { _ in })
        } else {
            // Telefon zrovna nedosažitelný → fronta, doručí se v pořadí.
            session.transferUserInfo(message)
        }
    }

    private func apply(_ dict: [String: Any]) {
        guard let next = WatchWorkoutSnapshot.decode(dict) else { return }
        guard next.seq >= lastSeq else { return }
        lastSeq = next.seq
        DispatchQueue.main.async {
            self.snapshot = next
            self.hasSnapshot = next.phase != .idle
        }
    }
}

extension WatchConnector: WCSessionDelegate {
    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        // Appka otevřená uprostřed tréninku: poslední kontext už tu je.
        let context = session.receivedApplicationContext
        if !context.isEmpty { apply(context) }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        apply(message)
    }
}
