import SwiftUI

// Fáze určuje obrazovku. Stav i akce jdou přes WatchConnector — hodinky samy
// o tréninku nerozhodují, zdrojem pravdy zůstává web na telefonu.
struct RootView: View {
    @StateObject private var connector = WatchConnector()

    var body: some View {
        ZStack {
            PumploTheme.navy.ignoresSafeArea()
            content
        }
        .onAppear { connector.activate() }
    }

    @ViewBuilder private var content: some View {
        if !connector.hasSnapshot {
            WaitingView()
        } else {
            switch connector.snapshot.phase {
            case .set:
                ActiveSetView(
                    snapshot: connector.snapshot,
                    onLog: { weight, reps in connector.send(action: "logSet", weight: weight, reps: reps) },
                    onPrev: { connector.send(action: "goPrevSet") },
                    onNext: { connector.send(action: "goNextSet") })
            case .rest:
                RestView(
                    snapshot: connector.snapshot,
                    onAdd15: { connector.send(action: "addRest15") },
                    onSkip: { connector.send(action: "skipRest") })
            case .summary:
                DoneView()
            case .idle:
                WaitingView()
            }
        }
    }
}
