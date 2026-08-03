import Foundation

// Trénink běžící PŘÍMO na hodinkách (samostatný režim). Zdrojem pravdy už není
// telefon, ale tenhle engine.
//
// Schválně vyrábí týž WatchWorkoutSnapshot, jaký v zrcadlovém režimu posílá
// telefon — díky tomu fungují všechny obrazovky (seznam, série, pauza, kardio)
// beze změny a nevzniká druhá sada UI.
//
// Čisté Foundation, žádná síť ani ukládání: engine se dá celý otestovat
// harnessem, což je u počítání sérií a pauz to nejdůležitější.
struct LocalWorkout: Codable {
    struct LoggedSet: Codable, Equatable {
        let weight: Double?
        let reps: Int
    }

    let workout: WatchApiWorkout
    let startedAt: Date
    // Idempotence uložení: UUID vzniká se začátkem tréninku a přežívá i pád
    // appky (Codable) — opakované odeslání z fronty trénink nezdvojí.
    let clientSessionId: String

    private(set) var exerciseIndex = 0
    private(set) var setNumber = 1               // 1-based, jako v appce
    private(set) var logged: [Int: [LoggedSet]] = [:]
    private(set) var restEndsAt: Date?
    private(set) var cardioEndsAt: Date?
    private(set) var cardioPausedAt: Date?
    private(set) var finished = false

    init(workout: WatchApiWorkout, startedAt: Date = Date(),
         clientSessionId: String = UUID().uuidString) {
        self.workout = workout
        self.startedAt = startedAt
        self.clientSessionId = clientSessionId
        // Trénink může začínat rozcvičkou — její odpočet běží hned.
        autoStartAux(now: startedAt)
    }

    var current: WatchApiExercise? {
        guard exerciseIndex >= 0 && exerciseIndex < workout.exercises.count else { return nil }
        return workout.exercises[exerciseIndex]
    }

    var isEmpty: Bool { workout.exercises.isEmpty }

    // MARK: - Akce (stejná jména jako akce z hodinek v zrcadlovém režimu)

    mutating func logSet(weight: Double?, reps: Int, now: Date = Date()) {
        guard let current, !finished, !current.isTimedAux else { return }
        logged[exerciseIndex, default: []].append(LoggedSet(weight: weight, reps: reps))

        let isLastSet = setNumber >= current.sets
        let isLastExercise = exerciseIndex >= workout.exercises.count - 1
        if isLastSet && isLastExercise {
            finished = true
            restEndsAt = nil
            return
        }

        let rest = current.restSeconds(forSet: setNumber)
        // Pauza nula znamená „bez pauzy" — jde se rovnou dál, jako v appce.
        if rest > 0 {
            restEndsAt = now.addingTimeInterval(TimeInterval(rest))
        } else {
            advanceAfterRest()
        }
    }

    mutating func skipRest() {
        guard restEndsAt != nil else { return }
        advanceAfterRest()
    }

    mutating func addRest(_ seconds: Int) {
        guard let restEndsAt else { return }
        self.restEndsAt = restEndsAt.addingTimeInterval(TimeInterval(seconds))
    }

    /// Doběhla pauza sama (volá se z tikotu obrazovky).
    mutating func restFinishedIfDue(now: Date = Date()) {
        guard let restEndsAt, now >= restEndsAt else { return }
        advanceAfterRest()
    }

    mutating func goToExercise(_ index: Int, now: Date = Date()) {
        guard index >= 0 && index < workout.exercises.count else { return }
        exerciseIndex = index
        setNumber = 1
        restEndsAt = nil
        resetCardio()
        autoStartAux(now: now)
    }

    mutating func goNextSet(now: Date = Date()) {
        guard let current else { return }
        restEndsAt = nil
        if setNumber < current.sets {
            setNumber += 1
        } else if exerciseIndex < workout.exercises.count - 1 {
            exerciseIndex += 1
            setNumber = 1
            resetCardio()
            autoStartAux(now: now)
        } else if current.isTimedAux {
            // „Hotovo" na poslední položce cooldownu trénink uzavírá.
            finished = true
        }
    }

    mutating func goPrevSet(now: Date = Date()) {
        restEndsAt = nil
        if setNumber > 1 {
            setNumber -= 1
        } else if exerciseIndex > 0 {
            exerciseIndex -= 1
            setNumber = 1
            resetCardio()
            autoStartAux(now: now)
        }
    }

    /// Doběhl odpočet položky rozcvičky/cooldownu — jde se dál samo, jako
    /// ve WarmupPlayeru v telefonu. Pauza odpočet drží na místě.
    mutating func timedAuxFinishedIfDue(now: Date = Date()) {
        guard let current, current.isTimedAux, cardioPausedAt == nil,
              let cardioEndsAt, now >= cardioEndsAt else { return }
        if exerciseIndex < workout.exercises.count - 1 {
            exerciseIndex += 1
            setNumber = 1
            restEndsAt = nil
            resetCardio()
            autoStartAux(now: now)
        } else {
            finished = true
            restEndsAt = nil
            resetCardio()
        }
    }

    /// Přeskočí zbytek rozcvičky (na první hlavní cvik) nebo cooldownu
    /// (rovnou na souhrn). Na hlavním cviku nedělá nic.
    mutating func skipSection(now: Date = Date()) {
        guard let current, current.isTimedAux else { return }
        let section = current.section
        var index = exerciseIndex
        while index < workout.exercises.count && workout.exercises[index].section == section {
            index += 1
        }
        restEndsAt = nil
        resetCardio()
        if index < workout.exercises.count {
            exerciseIndex = index
            setNumber = 1
            autoStartAux(now: now)
        } else {
            finished = true
        }
    }

    // Časované položky se nespouští ručně jako kardio — odpočet běží od
    // chvíle, kdy na ně dojde řada.
    private mutating func autoStartAux(now: Date) {
        guard let current, current.isTimedAux else { return }
        cardioEndsAt = now.addingTimeInterval(TimeInterval(current.durationSeconds ?? 0))
        cardioPausedAt = nil
    }

    mutating func toggleCardio(now: Date = Date()) {
        guard let current, current.isCardio else { return }
        if cardioEndsAt == nil {
            // První spuštění — odpočet začíná teď.
            cardioEndsAt = now.addingTimeInterval(TimeInterval(current.durationSeconds ?? 0))
            cardioPausedAt = nil
            return
        }
        if let pausedAt = cardioPausedAt {
            // Pokračování: konec se posune o dobu pauzy, aby se čas neztratil.
            cardioEndsAt = cardioEndsAt?.addingTimeInterval(now.timeIntervalSince(pausedAt))
            cardioPausedAt = nil
        } else {
            cardioPausedAt = now
        }
    }

    private mutating func advanceAfterRest(now: Date = Date()) {
        restEndsAt = nil
        resetCardio()
        guard let current else { return }
        if setNumber < current.sets {
            setNumber += 1
        } else if exerciseIndex < workout.exercises.count - 1 {
            exerciseIndex += 1
            setNumber = 1
            autoStartAux(now: now)
        } else {
            finished = true
        }
    }

    private mutating func resetCardio() {
        cardioEndsAt = nil
        cardioPausedAt = nil
    }

    // MARK: - Snapshot pro obrazovky

    func snapshot(now: Date = Date()) -> WatchWorkoutSnapshot {
        let items = workout.exercises.enumerated().map { index, ex in
            WatchExerciseItem(name: ex.name,
                              setsDone: logged[index]?.count ?? 0,
                              setsTotal: ex.sets,
                              thumbUrl: ex.thumbUrl)
        }
        let exercisesJson = (try? JSONEncoder().encode(items))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"

        let previous = logged[exerciseIndex]?.last
        let ex = current
        let reps = ex?.reps(forSet: setNumber) ?? (min: 0, max: 0)

        let phase: WatchWorkoutSnapshot.Phase = {
            if finished { return .summary }
            guard let ex else { return .idle }
            if restEndsAt != nil { return .rest }
            return ex.isCardio ? .cardio : .set
        }()

        return WatchWorkoutSnapshot(
            // seq nemá v samostatném režimu význam — snapshot nikdo neposílá.
            seq: 0,
            phase: phase,
            exerciseName: ex?.name ?? "",
            slotCategory: ex?.slotCategory,
            setIndex: max(0, setNumber - 1),
            totalSets: ex?.sets ?? 0,
            targetWeight: ex?.targetWeight(forSet: setNumber),
            targetReps: reps.max,
            repMin: reps.min,
            repMax: reps.max,
            rir: ex?.rir,
            prevWeight: previous?.weight,
            prevReps: previous?.reps,
            weightStep: 0.5,
            resting: restEndsAt != nil,
            restEndsAt: restEndsAt.map { $0.timeIntervalSince1970 * 1000 },
            nextSetLabel: nextLabel(),
            cardioTotalSeconds: ex?.durationSeconds ?? 0,
            cardioEndsAt: cardioEndsAt.map { $0.timeIntervalSince1970 * 1000 },
            cardioPausedAt: cardioPausedAt.map { $0.timeIntervalSince1970 * 1000 },
            menuJson: nil,
            workoutTitle: workout.title,
            workoutStartedAt: startedAt.timeIntervalSince1970 * 1000,
            exercisesJson: exercisesJson,
            currentExerciseIndex: exerciseIndex)
    }

    // Popisek pod odpočtem: co přijde po pauze.
    private func nextLabel() -> String? {
        guard restEndsAt != nil, let current else { return nil }
        if setNumber < current.sets { return "série \(setNumber + 1) z \(current.sets)" }
        guard exerciseIndex + 1 < workout.exercises.count else { return nil }
        return workout.exercises[exerciseIndex + 1].name
    }
}
