import Foundation

// Assertion harness pro čistou Swift logiku, která se dá přeložit i na macOS.
// Spouští se swiftc (viz níže), ne XCTestem — watchOS/iOS test target by kvůli
// pár čistým funkcím znamenal další target v projektu.
var failures = 0
func expect(_ condition: Bool, _ name: String) {
    if condition { print("ok   \(name)") } else { print("FAIL \(name)"); failures += 1 }
}

// MARK: - WatchPayload.sanitize

let sanitized = WatchPayload.sanitize([
    "phase": "set",
    "setIndex": 1,
    "targetWeight": NSNull(),
    "resting": false,
    "weightStep": 0.5,
])
expect(sanitized["targetWeight"] == nil, "sanitize drops NSNull")
expect(sanitized["phase"] as? String == "set", "sanitize keeps strings")
expect((sanitized["setIndex"] as? NSNumber)?.intValue == 1, "sanitize keeps numbers")
expect((sanitized["resting"] as? NSNumber)?.boolValue == false, "sanitize keeps false")
expect((sanitized["weightStep"] as? NSNumber)?.doubleValue == 0.5, "sanitize keeps doubles")
expect(JSONSerialization.isValidJSONObject(sanitized), "sanitize output is plist/JSON safe")

// MARK: - WatchPayload.isUrgent

expect(WatchPayload.isUrgent(previous: nil, next: ["phase": "set"]),
       "isUrgent true for the very first snapshot")
expect(WatchPayload.isUrgent(previous: ["phase": "set"], next: ["phase": "rest", "restEndsAt": 1.0]),
       "isUrgent true when the phase changes")
expect(WatchPayload.isUrgent(previous: ["phase": "rest", "restEndsAt": 1.0],
                             next: ["phase": "rest", "restEndsAt": 16.0]),
       "isUrgent true when the rest clock moves (+15 s)")
expect(!WatchPayload.isUrgent(previous: ["phase": "set", "setIndex": 1],
                              next: ["phase": "set", "setIndex": 2]),
       "isUrgent false for an ordinary set update")

// MARK: - WatchPayload.action

let logSet = WatchPayload.action(from: ["type": "logSet", "weight": 42.5, "reps": 10])
expect(logSet?["type"] as? String == "logSet", "action keeps the logSet type")
expect((logSet?["weight"] as? Double) == 42.5, "action keeps the weight")
expect((logSet?["reps"] as? Int) == 10, "action keeps the reps")

let bodyweight = WatchPayload.action(from: ["type": "logSet", "reps": 12])
expect(bodyweight?["weight"] == nil, "action omits a missing weight (JS reads it as undefined)")
expect((bodyweight?["reps"] as? Int) == 12, "action keeps reps without a weight")

expect(WatchPayload.action(from: ["type": "skipRest"])?["type"] as? String == "skipRest",
       "action passes simple actions through")
expect(WatchPayload.action(from: ["type": "addRest15"])?["type"] as? String == "addRest15",
       "action passes addRest15 through")
expect(WatchPayload.action(from: ["type": "selfDestruct"]) == nil, "action rejects unknown types")
expect(WatchPayload.action(from: ["reps": 5]) == nil, "action rejects a message without a type")


// MARK: - WatchWorkoutSnapshot

let restSnapshot = WatchWorkoutSnapshot.decode([
    "seq": 1_700_000_000_001,
    "phase": "rest",
    "exerciseName": "Šikmý tlak na prsa",
    "slotCategory": "main",
    "setIndex": 1, "totalSets": 4,
    "targetWeight": 40.0, "targetReps": 12, "repMin": 8, "repMax": 12, "rir": 2,
    "prevWeight": 37.5, "prevReps": 10,
    "weightStep": 0.5, "resting": true,
    "restEndsAt": 1_700_000_090_000,
    "nextSetLabel": "Série 3 z 4",
])
expect(restSnapshot?.phase == .rest, "decode reads the phase")
expect(restSnapshot?.exerciseName == "Šikmý tlak na prsa", "decode reads the exercise name")
expect(restSnapshot?.headerLabel == "Hlavní · série 2 z 4", "headerLabel is Czech and 1-based")
expect(restSnapshot?.targetLine == "Cíl 8–12 · RIR 2", "targetLine shows range and RIR")
expect(restSnapshot?.previousLine == "Naposledy: 37,5 kg × 10", "previousLine shows the last set")
expect(restSnapshot?.nextSetLabel == "Série 3 z 4", "decode reads nextSetLabel")
expect(restSnapshot?.remainingSeconds(now: Date(timeIntervalSince1970: 1_700_000_060)) == 30,
       "remainingSeconds counts down from restEndsAt")
expect(restSnapshot?.remainingSeconds(now: Date(timeIntervalSince1970: 1_700_000_200)) == 0,
       "remainingSeconds never goes negative")

// Chybějící klíč == null na straně telefonu (plugin NSNull zahazuje).
let sparse = WatchWorkoutSnapshot.decode([
    "seq": 2, "phase": "set", "exerciseName": "Dřep", "setIndex": 0, "totalSets": 3,
    "targetReps": 10, "repMin": 8, "repMax": 10, "weightStep": 0.5, "resting": false,
])
expect(sparse?.targetWeight == nil, "missing targetWeight decodes as nil")
expect(sparse?.rir == nil, "missing rir decodes as nil")
expect(sparse?.previousLine == nil, "previousLine is nil without a previous set")
expect(sparse?.targetLine == "Cíl 8–10", "targetLine omits RIR when unknown")
expect(sparse?.slotLabel == "", "slotLabel is empty without a category")
expect(sparse?.headerLabel == "série 1 z 3", "headerLabel drops the separator without a category")
expect(sparse?.prefillWeight == 0, "prefillWeight is 0 for a first-time exercise")
expect(sparse?.prefillReps == 10, "prefillReps uses the target reps")
expect(sparse?.stepValue == 0.5, "stepValue keeps the 0.5 kg contract")
expect(WatchWorkoutSnapshot.decode(["phase": "nonsense"]) == nil, "decode rejects an unknown phase")
expect(WatchWorkoutSnapshot.decode(["exerciseName": "x"]) == nil, "decode rejects a payload without a phase")

// MARK: - WatchFormat

expect(WatchFormat.weight(40) == "40", "whole weights have no decimals")
expect(WatchFormat.weight(37.5) == "37,5", "half steps use a Czech decimal comma")
expect(WatchFormat.weight(0) == "0", "zero weight renders as 0")
expect(WatchFormat.clock(75) == "1:15", "clock formats minutes and seconds")
expect(WatchFormat.clock(5) == "0:05", "clock pads seconds")

if failures > 0 { print("\(failures) failing"); exit(1) }
print("all native tests passed")
