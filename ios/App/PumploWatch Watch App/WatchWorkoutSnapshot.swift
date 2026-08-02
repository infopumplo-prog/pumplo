import Foundation

// Zrcadlo WatchWorkoutState z src/lib/watchWorkout.ts. Jen Foundation (žádné
// SwiftUI ani WatchConnectivity), aby se dekodér dal testovat harnessem.
struct WatchWorkoutSnapshot: Equatable {
    enum Phase: String { case set, rest, cardio, summary, idle }

    var seq: Double
    var phase: Phase
    var exerciseName: String
    var slotCategory: String?
    var setIndex: Int
    var totalSets: Int
    var targetWeight: Double?
    var targetReps: Int
    var repMin: Int
    var repMax: Int
    var rir: Int?
    var prevWeight: Double?
    var prevReps: Int?
    var weightStep: Double
    var resting: Bool
    var restEndsAt: Double?
    var nextSetLabel: String?
    var cardioTotalSeconds: Int
    var cardioEndsAt: Double?
    var cardioPausedAt: Double?
    // Nabídka tréninků; telefon ji přibaluje ke každému snapshotu.
    var menuJson: String?
    // Seznam cviků aktuálního tréninku + hlavička nad ním.
    var workoutTitle: String
    var workoutStartedAt: Double?
    var exercisesJson: String?
    var currentExerciseIndex: Int

    static let idle = WatchWorkoutSnapshot(
        seq: 0, phase: .idle, exerciseName: "", slotCategory: nil,
        setIndex: 0, totalSets: 0, targetWeight: nil, targetReps: 0,
        repMin: 0, repMax: 0, rir: nil, prevWeight: nil, prevReps: nil,
        weightStep: 0.5, resting: false, restEndsAt: nil, nextSetLabel: nil,
        cardioTotalSeconds: 0, cardioEndsAt: nil, cardioPausedAt: nil, menuJson: nil,
        workoutTitle: "", workoutStartedAt: nil, exercisesJson: nil, currentExerciseIndex: 0)

    // Chybějící klíč znamená null — plugin NSNull cestou zahazuje.
    static func decode(_ dict: [String: Any]) -> WatchWorkoutSnapshot? {
        guard let phase = Phase(rawValue: dict["phase"] as? String ?? "") else { return nil }
        func number(_ key: String) -> NSNumber? { dict[key] as? NSNumber }
        return WatchWorkoutSnapshot(
            seq: number("seq")?.doubleValue ?? 0,
            phase: phase,
            exerciseName: dict["exerciseName"] as? String ?? "",
            slotCategory: dict["slotCategory"] as? String,
            setIndex: number("setIndex")?.intValue ?? 0,
            totalSets: number("totalSets")?.intValue ?? 0,
            targetWeight: number("targetWeight")?.doubleValue,
            targetReps: number("targetReps")?.intValue ?? 0,
            repMin: number("repMin")?.intValue ?? 0,
            repMax: number("repMax")?.intValue ?? 0,
            rir: number("rir")?.intValue,
            prevWeight: number("prevWeight")?.doubleValue,
            prevReps: number("prevReps")?.intValue,
            weightStep: number("weightStep")?.doubleValue ?? 0.5,
            resting: number("resting")?.boolValue ?? false,
            restEndsAt: number("restEndsAt")?.doubleValue,
            nextSetLabel: dict["nextSetLabel"] as? String,
            cardioTotalSeconds: number("cardioTotalSeconds")?.intValue ?? 0,
            cardioEndsAt: number("cardioEndsAt")?.doubleValue,
            cardioPausedAt: number("cardioPausedAt")?.doubleValue,
            menuJson: dict["menuJson"] as? String,
            workoutTitle: dict["workoutTitle"] as? String ?? "",
            workoutStartedAt: number("workoutStartedAt")?.doubleValue,
            exercisesJson: dict["exercisesJson"] as? String,
            currentExerciseIndex: number("currentExerciseIndex")?.intValue ?? 0)
    }

    // Krok korunky. Nula by rozbila zaokrouhlování, proto pojistka.
    var stepValue: Double { weightStep > 0 ? weightStep : 0.5 }

    // Předvyplnění spinnerů: cíl > naposledy > 0 (vlastní váha).
    var prefillWeight: Double {
        let base = targetWeight ?? prevWeight ?? 0
        return (base / stepValue).rounded() * stepValue
    }
    var prefillReps: Int { targetReps > 0 ? targetReps : max(repMax, 1) }

    var slotLabel: String {
        switch slotCategory {
        case "main": return "Hlavní"
        case "secondary": return "Pomocný"
        case "isolation": return "Izolace"
        case "core": return "Core"
        case "conditioning": return "Kardio"
        default: return slotCategory ?? ""
        }
    }

    var setProgressLabel: String {
        "série \(min(setIndex + 1, max(totalSets, 1))) z \(max(totalSets, 1))"
    }

    var headerLabel: String {
        slotLabel.isEmpty ? setProgressLabel : "\(slotLabel) · \(setProgressLabel)"
    }

    var targetLine: String {
        let range = "Cíl \(repMin)–\(repMax)"
        guard let rir else { return range }
        return "\(range) · RIR \(rir)"
    }

    var previousLine: String? {
        guard let prevWeight, let prevReps else { return nil }
        return "Naposledy: \(WatchFormat.weight(prevWeight)) kg × \(prevReps)"
    }

    func remainingSeconds(now: Date = Date()) -> Int {
        guard let restEndsAt else { return 0 }
        return max(0, Int(ceil(restEndsAt / 1000 - now.timeIntervalSince1970)))
    }

    // Kardio: dokud nebylo spuštěné, ukazuje se celá délka; při pauze se počítá
    // od okamžiku pauzy, aby číslo na displeji stálo.
    func remainingCardioSeconds(now: Date = Date()) -> Int {
        guard let cardioEndsAt else { return max(0, cardioTotalSeconds) }
        let reference = cardioPausedAt ?? (now.timeIntervalSince1970 * 1000)
        return max(0, Int(ceil((cardioEndsAt - reference) / 1000)))
    }

    var isCardioPaused: Bool { cardioPausedAt != nil || cardioEndsAt == nil }

    var exercises: [WatchExerciseItem] {
        guard let exercisesJson else { return [] }
        return WatchExerciseList.decode(exercisesJson)
    }

    // Čas od začátku tréninku. Telefon posílá jen razítko startu, hodinky si
    // ho počítají samy — dopočítávaná hodnota by měnila snapshot při každém
    // renderu telefonu.
    func elapsedSeconds(now: Date = Date()) -> Int {
        guard let workoutStartedAt else { return 0 }
        return max(0, Int(now.timeIntervalSince1970 - workoutStartedAt / 1000))
    }
}

enum WatchFormat {
    // 40 → "40", 37.5 → "37,5" (desetinná čárka jako na mockupu).
    static func weight(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        if abs(rounded - rounded.rounded()) < 0.05 { return String(Int(rounded.rounded())) }
        return String(format: "%.1f", rounded).replacingOccurrences(of: ".", with: ",")
    }

    static func clock(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
