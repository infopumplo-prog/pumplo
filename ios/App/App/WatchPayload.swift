import Foundation

// Čisté helpery pro přenos telefon <-> hodinky. Schválně bez importu
// Capacitoru a WatchConnectivity, aby se soubor dal přeložit i na macOS a
// otestovat harnessem v ios/App/NativeTests.
enum WatchPayload {
    // WCSession bere jen property-list typy. JSON null z JS doletí jako NSNull
    // a updateApplicationContext by na něm vyhodil výjimku — chybějící klíč
    // znamená na hodinkách přesně totéž co null.
    static func sanitize(_ raw: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (key, value) in raw {
            if value is NSNull { continue }
            if let number = value as? NSNumber { out[key] = number; continue }
            if let text = value as? String { out[key] = text; continue }
            // Vnořené objekty ani pole nejsou součástí kontraktu — zahazujeme.
        }
        return out
    }

    // applicationContext doručuje systém líně. Start pauzy, změna fáze nebo
    // posun konce pauzy musí na hodinky dorazit hned, proto je plugin navíc
    // pošle jako přímou zprávu.
    static func isUrgent(previous: [String: Any]?, next: [String: Any]) -> Bool {
        guard let previous else { return true }
        if (previous["phase"] as? String) != (next["phase"] as? String) { return true }
        let previousEnd = (previous["restEndsAt"] as? NSNumber)?.doubleValue
        let nextEnd = (next["restEndsAt"] as? NSNumber)?.doubleValue
        if previousEnd != nextEnd { return true }
        // Start i pauza kardia musí dorazit hned, ne až líným applicationContextem.
        let previousCardio = (previous["cardioEndsAt"] as? NSNumber)?.doubleValue
        let nextCardio = (next["cardioEndsAt"] as? NSNumber)?.doubleValue
        if previousCardio != nextCardio { return true }
        let previousPause = (previous["cardioPausedAt"] as? NSNumber)?.doubleValue
        let nextPause = (next["cardioPausedAt"] as? NSNumber)?.doubleValue
        return previousPause != nextPause
    }

    // Hodinky -> telefon. Propouští jen známé tvary, aby novější watch build
    // nemohl rozbít starší telefonní build.
    static func action(from message: [String: Any]) -> [String: Any]? {
        guard let type = message["type"] as? String else { return nil }
        switch type {
        case "logSet":
            var payload: [String: Any] = ["type": type]
            if let weight = (message["weight"] as? NSNumber)?.doubleValue { payload["weight"] = weight }
            payload["reps"] = (message["reps"] as? NSNumber)?.intValue ?? 0
            return payload
        case "goPrevSet", "goNextSet", "skipRest", "addRest15", "cardioToggle",
             "standaloneStarted", "standaloneEnded", "requestAuth":
            return ["type": type]
        case "goToExercise":
            guard let index = (message["index"] as? NSNumber)?.intValue, index >= 0 else { return nil }
            return ["type": type, "index": index]
        case "startWorkout":
            guard let kind = message["kind"] as? String,
                  ["resume", "plan", "custom"].contains(kind) else { return nil }
            var payload: [String: Any] = ["type": type, "kind": kind]
            if let planId = message["planId"] as? String { payload["planId"] = planId }
            if let dayId = message["dayId"] as? String { payload["dayId"] = dayId }
            return payload
        default:
            return nil
        }
    }
}
