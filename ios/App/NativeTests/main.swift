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

if failures > 0 { print("\(failures) failing"); exit(1) }
print("all native tests passed")
