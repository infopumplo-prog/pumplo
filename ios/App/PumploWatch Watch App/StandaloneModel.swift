import Foundation

// Samostatný režim: hodinky si nabídku i trénink stáhnou samy z watch-api a
// odcvičí ho vlastním enginem (LocalWorkout). Telefon není potřeba.
//
// Model drží jen stav a síť — počítání sérií a pauz je v LocalWorkout, který
// je celý otestovaný harnessem.
@MainActor
final class StandaloneModel: ObservableObject {
    @Published private(set) var menu: WatchApiMenu?
    @Published private(set) var workout: LocalWorkout?
    @Published private(set) var isLoading = false
    @Published private(set) var error: String?

    private let auth: WatchAuthStore

    init(auth: WatchAuthStore) {
        self.auth = auth
    }

    var isRunning: Bool { workout != nil }

    var snapshot: WatchWorkoutSnapshot? { workout?.snapshot() }

    func loadMenu() async {
        guard auth.state == .signedIn, !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
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
        } catch WatchAuthError.signedOut {
            error = nil
        } catch {
            self.error = "Nepovedlo se stáhnout trénink"
        }
    }

    func clearError() { error = nil }

    func endWorkout() { workout = nil }

    // MARK: - Akce z obrazovek

    func logSet(weight: Double, reps: Int) { workout?.logSet(weight: weight, reps: reps) }
    func skipRest() { workout?.skipRest() }
    func addRest15() { workout?.addRest(15) }
    func goNextSet() { workout?.goNextSet() }
    func goPrevSet() { workout?.goPrevSet() }
    func goToExercise(_ index: Int) { workout?.goToExercise(index) }
    func toggleCardio() { workout?.toggleCardio() }

    /// Tikot z obrazovky: pauza musí doběhnout i když se na ni nikdo nedívá.
    func tick() {
        guard workout != nil else { return }
        workout?.restFinishedIfDue()
    }
}
