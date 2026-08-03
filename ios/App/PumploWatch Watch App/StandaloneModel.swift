import Foundation

// Samostatný režim: hodinky si nabídku i trénink stáhnou samy z watch-api a
// odcvičí ho vlastním enginem (LocalWorkout). Telefon není potřeba.
//
// Model drží jen stav, síť a disk — počítání sérií a pauz je v LocalWorkout,
// který je celý otestovaný harnessem. Po každé akci se stav ukládá na disk,
// aby zabití appky uprostřed tréninku neznamenalo ztrátu sérií; dokončený
// trénink, který se nepovede odeslat, jde do fronty a počká si na signál.
@MainActor
final class StandaloneModel: ObservableObject {
    enum UploadState: Equatable {
        case idle
        case saving
        case saved
        case queued   // „Uloží se, až bude signál"
    }

    @Published private(set) var menu: WatchApiMenu?
    @Published private(set) var workout: LocalWorkout?
    @Published private(set) var isLoading = false
    @Published private(set) var error: String?
    @Published private(set) var uploadState: UploadState = .idle

    private let auth: WatchAuthStore
    private let store: StandaloneStore

    init(auth: WatchAuthStore, store: StandaloneStore = StandaloneStore()) {
        self.auth = auth
        self.store = store
        // Obnova po zabití appky: rozdělaný trénink pokračuje tam, kde byl.
        // Dokončený se do UI neobnovuje — jen se dopošle frontou.
        if let restored = store.loadActive() {
            if restored.finished {
                if let body = WatchApi.completionBody(for: restored) { store.enqueue(body) }
                store.clearActive()
            } else {
                workout = restored
            }
        }
    }

    var isRunning: Bool { workout != nil }

    // Odhlášení (nebo změna účtu) v telefonu: nabídka patřila starému účtu.
    func clearMenu() { menu = nil }

    var snapshot: WatchWorkoutSnapshot? { workout?.snapshot() }

    func loadMenu() async {
        guard auth.state == .signedIn, !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        await flushQueue()
        do {
            let token = try await auth.validAccessToken()
            guard let request = WatchApi.menuRequest(baseUrl: WatchConfig.watchApiUrl,
                                                     anonKey: WatchConfig.supabaseAnonKey,
                                                     accessToken: token) else { return }
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let decoded = WatchApi.decodeMenu(data) else {
                error = "Nepovedlo se načíst tréninky"
                return
            }
            menu = decoded
        } catch WatchAuthError.signedOut {
            error = nil // obrazovku převezme SignedOutView
        } catch {
            self.error = "Nepovedlo se načíst tréninky"
        }
    }

    func startPlanWorkout() async { await start { token in
        WatchApi.planWorkoutRequest(baseUrl: WatchConfig.watchApiUrl,
                                    anonKey: WatchConfig.supabaseAnonKey, accessToken: token)
    } }

    func startCustomWorkout(planId: String, dayId: String) async { await start { token in
        WatchApi.customWorkoutRequest(baseUrl: WatchConfig.watchApiUrl,
                                      anonKey: WatchConfig.supabaseAnonKey, accessToken: token,
                                      planId: planId, dayId: dayId)
    } }

    private func start(_ build: (String) -> URLRequest?) async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let token = try await auth.validAccessToken()
            guard let request = build(token) else { return }
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200, let decoded = WatchApi.decodeWorkout(data) else {
                error = status == 404 ? "Žádný trénink k dispozici" : "Nepovedlo se stáhnout trénink"
                return
            }
            guard !decoded.exercises.isEmpty else {
                error = "Trénink nemá žádné cviky"
                return
            }
            // Celý trénink je stažený dopředu — od téhle chvíle hodinky síť
            // nepotřebují, což je v posilovně to podstatné.
            workout = LocalWorkout(workout: decoded)
            uploadState = .idle
            persist()
        } catch WatchAuthError.signedOut {
            error = nil
        } catch {
            self.error = "Nepovedlo se stáhnout trénink"
        }
    }

    func clearError() { error = nil }

    /// Zavření souhrnu: uklidí stav a vrátí hodinky na nabídku.
    func endWorkout() {
        workout = nil
        uploadState = .idle
        store.clearActive()
        Task { await loadMenu() }
    }

    // MARK: - Akce z obrazovek

    func logSet(weight: Double, reps: Int) {
        workout?.logSet(weight: weight, reps: reps)
        persist()
        finishIfDone()
    }
    func skipRest() { workout?.skipRest(); persist(); finishIfDone() }
    func addRest15() { workout?.addRest(15); persist() }
    func goNextSet() { workout?.goNextSet(); persist() }
    func goPrevSet() { workout?.goPrevSet(); persist() }
    func goToExercise(_ index: Int) { workout?.goToExercise(index); persist() }
    func toggleCardio() { workout?.toggleCardio(); persist() }

    /// Tikot z obrazovky: pauza musí doběhnout i když se na ni nikdo nedívá.
    func tick() {
        guard workout != nil else { return }
        let wasResting = workout?.restEndsAt != nil
        workout?.restFinishedIfDue()
        if wasResting && workout?.restEndsAt == nil {
            persist()
            finishIfDone()
        }
    }

    // MARK: - Uložení dokončeného tréninku

    private func persist() {
        guard let workout else { return }
        store.saveActive(workout)
    }

    // Trénink právě skončil → jedno odeslání celého záznamu. Selhání není
    // chyba pro uživatele: tělo jde do fronty a odešle se, až bude signál.
    private func finishIfDone() {
        guard let workout, workout.finished, uploadState == .idle else { return }
        uploadState = .saving
        Task { await upload(workout) }
    }

    private func upload(_ finished: LocalWorkout) async {
        guard let body = WatchApi.completionBody(for: finished) else {
            uploadState = .queued
            return
        }
        // Aktivní soubor pryč hned — případný pád už neobnoví hotový trénink
        // do UI, dopošle ho fronta.
        store.clearActive()
        if await send(body) {
            uploadState = .saved
        } else {
            store.enqueue(body)
            uploadState = .queued
        }
    }

    /// Fronta se posílá při každém otevření nabídky — tedy i tehdy, když
    /// uživatel mezitím odcvičí další trénink.
    private func flushQueue() async {
        let queue = store.loadQueue()
        guard !queue.isEmpty else { return }
        var remaining: [Data] = []
        for body in queue {
            if !(await send(body)) { remaining.append(body) }
        }
        store.saveQueue(remaining)
        if remaining.isEmpty && uploadState == .queued { uploadState = .saved }
    }

    private func send(_ body: Data) async -> Bool {
        do {
            let token = try await auth.validAccessToken()
            guard let request = WatchApi.completeRequest(baseUrl: WatchConfig.watchApiUrl,
                                                         anonKey: WatchConfig.supabaseAnonKey,
                                                         accessToken: token, body: body) else { return false }
            let (_, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            // 2xx uložilo (nebo dedupovalo). 4xx se opakováním nespraví —
            // nechat takové tělo ve frontě navěky by ucpalo odesílání.
            return (200...299).contains(status) || (400...499).contains(status)
        } catch {
            return false
        }
    }
}
