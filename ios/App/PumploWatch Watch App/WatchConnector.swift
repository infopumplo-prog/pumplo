import Foundation
import WatchConnectivity

// Příjem stavu z telefonu a odesílání akcí zpět. Stav chodí dvěma cestami
// (applicationContext + přímá zpráva u urgentních přechodů), takže se může
// zopakovat nebo dorazit na přeskáčku — rozhoduje seq, starší se zahodí.
final class WatchConnector: NSObject, ObservableObject {
    @Published private(set) var snapshot: WatchWorkoutSnapshot = .idle
    @Published private(set) var hasSnapshot = false
    @Published private(set) var menu: WatchMenu = .empty
    @Published private(set) var startState: StartState = .idle

    // Přihlášení předané telefonem. Connector ho jen přebírá a předává dál —
    // ukládání a obnovu řeší WatchAuthStore.
    var onAuth: ((WatchAuthToken) -> Void)?
    var onAuthCleared: (() -> Void)?

    // Spouštění tréninku z hodinek. Telefon se dá jen probudit, ne vytáhnout do
    // popředí — když do timeoutu nedorazí snapshot, přiznáme to.
    enum StartState: Equatable {
        case idle
        case sending(since: Date)
        case failed(String)
    }

    static let startTimeout: TimeInterval = 6

    private var lastSeq: Double = -1

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func send(action: String, weight: Double? = nil, reps: Int? = nil, index: Int? = nil) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        var message: [String: Any] = ["type": action]
        if let weight { message["weight"] = weight }
        if let reps { message["reps"] = reps }
        if let index { message["index"] = index }

        if session.isReachable {
            session.sendMessage(message, replyHandler: nil, errorHandler: { _ in })
        } else {
            // Telefon zrovna nedosažitelný → fronta, doručí se v pořadí.
            session.transferUserInfo(message)
        }
    }

    func startWorkout(_ item: WatchMenuItem) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        // startWorkout se NIKDY nefrontuje — trénink spuštěný za dvacet minut,
        // až se spojení vrátí, je horší než žádný.
        guard session.activationState == .activated, session.isReachable else {
            startState = .failed("Telefon není v dosahu")
            return
        }
        var message: [String: Any] = ["type": "startWorkout", "kind": item.kind]
        if let planId = item.planId { message["planId"] = planId }
        if let dayId = item.dayId { message["dayId"] = dayId }
        startState = .sending(since: Date())
        session.sendMessage(message, replyHandler: nil, errorHandler: { [weak self] _ in
            DispatchQueue.main.async { self?.startState = .failed("Otevři Pumplo v telefonu") }
        })
    }

    // Volá tikot z MenuView — po timeoutu se čekání překlopí do hlášky.
    func checkStartTimeout(now: Date = Date()) {
        guard case .sending(let since) = startState else { return }
        if now.timeIntervalSince(since) >= Self.startTimeout {
            startState = .failed("Otevři Pumplo v telefonu")
        }
    }

    func clearStartState() { startState = .idle }

    private func apply(_ dict: [String: Any]) {
        guard let next = WatchWorkoutSnapshot.decode(dict) else { return }
        guard next.seq >= lastSeq else { return }
        lastSeq = next.seq
        DispatchQueue.main.async {
            self.snapshot = next
            self.hasSnapshot = next.phase != .idle
            // Poslední neprázdnou nabídku si držíme — snapshot bez menuJson
            // (nebo s rozbitým) ji nesmí smazat.
            if let json = next.menuJson, let decoded = WatchMenu.decode(json) {
                self.menu = decoded
            }
            // Trénink naběhl → čekání na start skončilo.
            if next.phase != .idle { self.startState = .idle }
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

    // Přihlášení chodí frontou (transferUserInfo) — musí dorazit i tehdy, když
    // hodinky zrovna spaly, na rozdíl od snapshotu, kde platí jen ten poslední.
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        if let token = WatchAuthToken.decode(userInfo: userInfo) {
            DispatchQueue.main.async { self.onAuth?(token) }
            return
        }
        if WatchAuthToken.isClearMessage(userInfo: userInfo) {
            DispatchQueue.main.async { self.onAuthCleared?() }
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        apply(message)
    }
}
