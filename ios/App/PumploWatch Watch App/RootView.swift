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
        // Trénink neběží → nabídka, kterou telefon poslal dopředu. Dokud
        // nedorazila (čerstvě nainstalované hodinky), zůstává „Čekám na telefon".
        if !connector.hasSnapshot || connector.snapshot.phase == .idle {
            if connector.menu.items.isEmpty {
                WaitingView()
            } else {
                MenuView(menu: connector.menu,
                         startState: connector.startState,
                         onStart: { connector.startWorkout($0) },
                         onRetry: { connector.clearStartState() },
                         onTick: { connector.checkStartTimeout() })
            }
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
            case .cardio:
                CardioView(
                    snapshot: connector.snapshot,
                    onToggle: { connector.send(action: "cardioToggle") },
                    onDone: { connector.send(action: "goNextSet") })
            case .summary:
                DoneView()
            case .idle:
                // Nedosažitelná větev — idle řeší podmínka výše.
                EmptyView()
            }
        }
    }
}
