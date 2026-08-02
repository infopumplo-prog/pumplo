import SwiftUI

// Fáze určuje obrazovku. Stav i akce jdou přes WatchConnector — hodinky samy
// o tréninku nerozhodují, zdrojem pravdy zůstává web na telefonu.
//
// Během tréninku je kořenem SEZNAM cviků a série, pauza i kardio se na něj
// vrství — šipkou zpět se uživatel kdykoliv vrátí na seznam.
struct RootView: View {
    @StateObject private var connector = WatchConnector()
    @StateObject private var auth = WatchAuthStore()
    @State private var showingDetail = false

    var body: some View {
        ZStack {
            PumploTheme.navy.ignoresSafeArea()
            content
        }
        .onAppear {
            // Přihlášení předává telefon jednorázově; hodinky si ho pak drží
            // samy, takže se načítá z Keychainu ještě před spojením.
            auth.load()
            connector.onAuth = { auth.accept($0) }
            connector.onAuthCleared = { auth.clear() }
            connector.activate()
            Task { await auth.verifyAccess() }
        }
    }

    private var isIdle: Bool { !connector.hasSnapshot || connector.snapshot.phase == .idle }

    @ViewBuilder private var content: some View {
        // Trénink neběží → nabídka, kterou telefon poslal dopředu. Dokud
        // nedorazila (čerstvě nainstalované hodinky), zůstává „Čekám na telefon".
        if isIdle {
            if auth.state == .signedOut {
                // Bez přihlášení nemá samostatný režim jak sáhnout na server.
                SignedOutView()
            } else if connector.menu.items.isEmpty {
                WaitingView()
            } else {
                MenuView(menu: connector.menu,
                         startState: connector.startState,
                         onStart: { connector.startWorkout($0) },
                         onRetry: { connector.clearStartState() },
                         onTick: { connector.checkStartTimeout() })
            }
        } else {
            NavigationStack {
                ExerciseListView(
                    snapshot: connector.snapshot,
                    currentIndex: connector.snapshot.currentExerciseIndex,
                    onSelect: { index in
                        connector.send(action: "goToExercise", index: index)
                        showingDetail = true
                    })
                    .navigationDestination(isPresented: $showingDetail) { detail }
            }
            // Trénink právě naběhl → rovnou do série, seznam je jedno ťuknutí zpět.
            .onAppear { showingDetail = true }
            // Pauza a kardio se musí ukázat samy, i když uživatel kouká na
            // seznam — jinak by mu utekl odpočet.
            .onChange(of: connector.snapshot.phase) { _, phase in
                if phase == .rest || phase == .cardio || phase == .summary { showingDetail = true }
            }
        }
    }

    @ViewBuilder private var detail: some View {
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
