import SwiftUI

// Hodinky umí dva režimy:
//
//   SAMOSTATNÝ — trénink si stáhly z watch-api a počítají ho samy (LocalWorkout).
//   ZRCADLO    — trénink běží v telefonu a hodinky zobrazují jeho snapshot.
//
// Obě cesty končí u TÝCHŽ obrazovek, protože samostatný engine vyrábí stejný
// WatchWorkoutSnapshot, jaký posílá telefon. Rozhoduje ten, kdo začal dřív:
// běžící vlastní trénink má přednost před snapshotem z telefonu.
//
// Kořenem během tréninku je seznam cviků; série, pauza i kardio se na něj
// vrství a šipkou zpět se uživatel vrátí na seznam.
struct RootView: View {
    @StateObject private var connector = WatchConnector()
    @StateObject private var auth = WatchAuthStore()
    @StateObject private var standalone: StandaloneModel
    @State private var showingDetail = false

    init() {
        let auth = WatchAuthStore()
        _auth = StateObject(wrappedValue: auth)
        _standalone = StateObject(wrappedValue: StandaloneModel(auth: auth))
    }

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

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
            Task {
                await auth.verifyAccess()
                await standalone.loadMenu()
            }
        }
        .onReceive(ticker) { _ in standalone.tick() }
        // Souběh: telefon se musí dozvědět, že na hodinkách běží vlastní
        // trénink — při pokusu o start pak upozorní. send() frontuje přes
        // transferUserInfo, takže zpráva dojde i bez přímého spojení.
        .onChange(of: standalone.isRunning) { _, running in
            connector.send(action: running ? "standaloneStarted" : "standaloneEnded")
        }
    }

    // Snapshot, podle kterého se kreslí obrazovky. Vlastní trénink vyhrává.
    private var activeSnapshot: WatchWorkoutSnapshot? {
        if let own = standalone.snapshot { return own }
        if connector.hasSnapshot && connector.snapshot.phase != .idle { return connector.snapshot }
        return nil
    }

    @ViewBuilder private var content: some View {
        if let snapshot = activeSnapshot {
            workoutStack(snapshot)
        } else if auth.state == .signedOut {
            // Bez přihlášení nemá samostatný režim jak sáhnout na server.
            SignedOutView()
        } else {
            idleContent
        }
    }

    // Trénink neběží: nabídka stažená z watch-api. Když se ji nepodařilo
    // načíst, spadne se na nabídku poslanou telefonem, a teprve pak na čekání.
    @ViewBuilder private var idleContent: some View {
        if let menu = standalone.menu, menu.plan != nil || !menu.customDays.isEmpty {
            StandaloneMenuView(
                menu: menu,
                isLoading: standalone.isLoading,
                error: standalone.error,
                onPlan: { Task { await standalone.startPlanWorkout() } },
                onCustom: { day in Task { await standalone.startCustomWorkout(planId: day.planId, dayId: day.dayId) } },
                onRetry: { standalone.clearError(); Task { await standalone.loadMenu() } })
        } else if !connector.menu.items.isEmpty {
            MenuView(menu: connector.menu,
                     startState: connector.startState,
                     onStart: { connector.startWorkout($0) },
                     onRetry: { connector.clearStartState() },
                     onTick: { connector.checkStartTimeout() })
        } else {
            WaitingView()
        }
    }

    private func workoutStack(_ snapshot: WatchWorkoutSnapshot) -> some View {
        NavigationStack {
            ExerciseListView(
                snapshot: snapshot,
                currentIndex: snapshot.currentExerciseIndex,
                onSelect: { index in
                    goToExercise(index)
                    showingDetail = true
                })
                .navigationDestination(isPresented: $showingDetail) {
                    // Prázdný nadpis: šipka zpět zůstane, ale lišta nesežere
                    // výšku, kterou obrazovka série potřebuje na tlačítka.
                    detail(snapshot)
                        .navigationTitle("")
                        .navigationBarTitleDisplayMode(.inline)
                }
        }
        // Trénink právě naběhl → rovnou do série, seznam je jedno ťuknutí zpět.
        .onAppear { showingDetail = true }
        // Pauza a kardio se musí ukázat samy, i když uživatel kouká na seznam —
        // jinak by mu utekl odpočet.
        .onChange(of: snapshot.phase) { _, phase in
            if phase == .rest || phase == .cardio || phase == .summary { showingDetail = true }
        }
    }

    @ViewBuilder private func detail(_ snapshot: WatchWorkoutSnapshot) -> some View {
        switch snapshot.phase {
        case .set:
            ActiveSetView(
                snapshot: snapshot,
                onLog: { weight, reps in logSet(weight: weight, reps: reps) },
                onPrev: { goPrevSet() },
                onNext: { goNextSet() })
        case .rest:
            RestView(
                snapshot: snapshot,
                onAdd15: { addRest15() },
                onSkip: { skipRest() })
        case .cardio:
            CardioView(
                snapshot: snapshot,
                onToggle: { toggleCardio() },
                onDone: { goNextSet() })
        case .summary:
            if isStandalone {
                DoneView(statusText: uploadStatusText, onClose: { standalone.endWorkout() })
            } else {
                DoneView()
            }
        case .idle:
            EmptyView()
        }
    }

    // MARK: - Akce míří tam, odkud trénink pochází

    private var isStandalone: Bool { standalone.isRunning }

    private var uploadStatusText: String? {
        switch standalone.uploadState {
        case .saving: return "Ukládám…"
        case .saved: return "Trénink uložen"
        case .queued: return "Uloží se, až bude signál"
        case .idle: return nil
        }
    }

    private func logSet(weight: Double, reps: Int) {
        if isStandalone { standalone.logSet(weight: weight, reps: reps) }
        else { connector.send(action: "logSet", weight: weight, reps: reps) }
    }
    private func skipRest() {
        if isStandalone { standalone.skipRest() } else { connector.send(action: "skipRest") }
    }
    private func addRest15() {
        if isStandalone { standalone.addRest15() } else { connector.send(action: "addRest15") }
    }
    private func goNextSet() {
        if isStandalone { standalone.goNextSet() } else { connector.send(action: "goNextSet") }
    }
    private func goPrevSet() {
        if isStandalone { standalone.goPrevSet() } else { connector.send(action: "goPrevSet") }
    }
    private func goToExercise(_ index: Int) {
        if isStandalone { standalone.goToExercise(index) }
        else { connector.send(action: "goToExercise", index: index) }
    }
    private func toggleCardio() {
        if isStandalone { standalone.toggleCardio() } else { connector.send(action: "cardioToggle") }
    }
}
