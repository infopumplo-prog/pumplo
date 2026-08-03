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

// MARK: - nabídka

let start = WatchPayload.action(from: ["type": "startWorkout", "kind": "custom", "planId": "p1", "dayId": "d1"])
expect(start?["kind"] as? String == "custom", "action keeps the startWorkout kind")
expect(start?["planId"] as? String == "p1", "action keeps the plan id")
expect(WatchPayload.action(from: ["type": "startWorkout", "kind": "nonsense"]) == nil,
       "action rejects an unknown startWorkout kind")
expect(WatchPayload.action(from: ["type": "startWorkout"]) == nil,
       "action rejects startWorkout without a kind")

let menu = WatchMenu.decode(#"{"items":[{"kind":"plan","label":"Dnešní trénink"}],"truncated":false}"#)
expect(menu?.items.count == 1, "menu decodes its items")
expect(menu?.items.first?.label == "Dnešní trénink", "menu keeps the label")
expect(menu?.items.first?.planId == nil, "menu allows items without a plan id")
expect(WatchMenu.decode("nonsense") == nil, "menu rejects broken json")

// MARK: - kardio

expect(WatchPayload.action(from: ["type": "cardioToggle"])?["type"] as? String == "cardioToggle",
       "action passes cardioToggle through")
expect(WatchPayload.action(from: ["type": "requestAuth"])?["type"] as? String == "requestAuth",
       "action passes requestAuth through")
expect(WatchPayload.isUrgent(previous: ["phase": "cardio", "cardioPausedAt": 1.0],
                             next: ["phase": "cardio"]),
       "isUrgent true when cardio is resumed")
expect(WatchPayload.isUrgent(previous: ["phase": "cardio", "cardioEndsAt": 1.0],
                             next: ["phase": "cardio", "cardioEndsAt": 2.0]),
       "isUrgent true when the cardio clock moves")

let cardio = WatchWorkoutSnapshot.decode([
    "phase": "cardio", "cardioTotalSeconds": 600,
    "cardioEndsAt": 1_700_000_600_000.0, "cardioPausedAt": 1_700_000_300_000.0,
])
expect(cardio?.phase == .cardio, "decode understands the cardio phase")
expect(cardio?.remainingCardioSeconds() == 300, "paused cardio counts from the pause, not from now")

let notStarted = WatchWorkoutSnapshot.decode(["phase": "cardio", "cardioTotalSeconds": 600])
expect(notStarted?.remainingCardioSeconds() == 600, "cardio that never started shows its full length")

// MARK: - DragStepper

expect(DragStepper.pointsPerStep == 8, "one step per 8 points of drag")
expect(DragStepper.totalSteps(translationHeight: -16) == 2, "dragging up adds steps")
expect(DragStepper.totalSteps(translationHeight: 16) == -2, "dragging down subtracts steps")
expect(DragStepper.totalSteps(translationHeight: -7) == 0, "a drag shorter than one step does nothing")
expect(DragStepper.totalSteps(translationHeight: -160) == 20, "a full-screen drag is 20 steps")
expect(DragStepper.totalSteps(translationHeight: 0) == 0, "no drag, no steps")

// MARK: - WatchFormat

expect(WatchFormat.weight(40) == "40", "whole weights have no decimals")
expect(WatchFormat.weight(37.5) == "37,5", "half steps use a Czech decimal comma")
expect(WatchFormat.weight(0) == "0", "zero weight renders as 0")
expect(WatchFormat.clock(75) == "1:15", "clock formats minutes and seconds")
expect(WatchFormat.clock(5) == "0:05", "clock pads seconds")

// MARK: - seznam cviků

let goTo = WatchPayload.action(from: ["type": "goToExercise", "index": 3])
expect((goTo?["index"] as? Int) == 3, "action keeps the exercise index")
expect(WatchPayload.action(from: ["type": "goToExercise"]) == nil, "action rejects goToExercise without an index")
expect(WatchPayload.action(from: ["type": "goToExercise", "index": -1]) == nil, "action rejects a negative index")

let listed = WatchWorkoutSnapshot.decode([
    "phase": "set", "workoutTitle": "Trénink A", "workoutStartedAt": 1_700_000_000_000.0,
    "exercisesJson": #"[{"name":"Dřep","setsDone":2,"setsTotal":4,"thumbUrl":"https://x/t.jpg"}]"#,
])
expect(listed?.workoutTitle == "Trénink A", "decode keeps the workout title")
expect(listed?.exercises.count == 1, "decode parses the exercise list")
expect(listed?.exercises.first?.progressLabel == "2 z 4 sérií", "exercise row shows set progress")
expect(listed?.exercises.first?.isDone == false, "an unfinished exercise is not done")
expect(listed?.elapsedSeconds(now: Date(timeIntervalSince1970: 1_700_000_090)) == 90,
       "elapsed time counts from the start stamp")
expect(WatchWorkoutSnapshot.decode(["phase": "set"])?.exercises.isEmpty == true,
       "a snapshot without a list decodes to no exercises")

// MARK: - přihlášení hodinek

let authInfo: [String: Any] = [
    "type": "auth", "accessToken": "acc", "refreshToken": "ref",
    "expiresAt": 1_700_003_600.0, "userId": "u1",
]
expect(WatchAuthToken.decode(userInfo: authInfo)?.accessToken == "acc", "auth decodes a full session")
expect(WatchAuthToken.decode(userInfo: authInfo)?.userId == "u1", "auth keeps the user id")
expect(WatchAuthToken.decode(userInfo: ["type": "auth", "accessToken": "acc"]) == nil,
       "auth rejects a half session")
expect(WatchAuthToken.decode(userInfo: ["type": "auth", "accessToken": "", "refreshToken": "r",
                                        "expiresAt": 1.0, "userId": "u"]) == nil,
       "auth rejects an empty access token")
expect(WatchAuthToken.decode(userInfo: ["type": "snapshot"]) == nil, "auth ignores other messages")
expect(WatchAuthToken.isClearMessage(userInfo: ["type": "authCleared"]), "auth recognises a logout")

expect(WatchAuth.needsRefresh(expiresAt: 1_700_000_000, now: 1_699_999_800),
       "a token expiring within the margin needs a refresh")
expect(!WatchAuth.needsRefresh(expiresAt: 1_700_000_000, now: 1_699_996_000),
       "a token with plenty of time does not")
expect(WatchAuth.needsRefresh(expiresAt: 1_699_000_000, now: 1_700_000_000),
       "an expired token needs a refresh")

let refreshReq = WatchAuth.refreshRequest(baseUrl: "https://auth.pumplo.com", anonKey: "key", refreshToken: "ref")
expect(refreshReq?.url?.absoluteString == "https://auth.pumplo.com/auth/v1/token?grant_type=refresh_token",
       "refresh hits the Supabase token endpoint")
expect(refreshReq?.value(forHTTPHeaderField: "apikey") == "key", "refresh sends the anon key")
expect(refreshReq?.httpMethod == "POST", "refresh is a POST")

let previous = WatchAuthToken(accessToken: "old", refreshToken: "oldRef", expiresAt: 1, userId: "u1")
let refreshed = WatchAuth.parseRefresh(
    #"{"access_token":"new","refresh_token":"newRef","expires_at":1700000000}"#.data(using: .utf8)!,
    previous: previous, now: 0)
expect(refreshed?.accessToken == "new", "refresh parses the new access token")
expect(refreshed?.refreshToken == "newRef", "refresh parses the rotated refresh token")
expect(refreshed?.expiresAt == 1_700_000_000, "refresh parses the expiry")
expect(refreshed?.userId == "u1", "refresh keeps the user id when the response omits it")

let noRotation = WatchAuth.parseRefresh(
    #"{"access_token":"new","expires_in":3600}"#.data(using: .utf8)!, previous: previous, now: 1_000)
expect(noRotation?.refreshToken == "oldRef", "refresh keeps the old token when none is rotated")
expect(noRotation?.expiresAt == 4_600, "refresh falls back to expires_in")
expect(WatchAuth.parseRefresh(#"{"error":"invalid"}"#.data(using: .utf8)!, previous: previous, now: 0) == nil,
       "refresh rejects an error response")

// MARK: - samostatný trénink na hodinkách

func makeExercise(_ name: String, sets: Int, rest: Int = 60, cardio: Bool = false,
                  duration: Int? = nil) -> WatchApiExercise {
    WatchApiExercise(exerciseId: "e-\(name)", name: name, nameEn: nil, slotCategory: "main",
                     sets: sets, repMin: 8, repMax: 12, rir: 2, targetWeight: 40,
                     restSeconds: rest, isCardio: cardio, durationSeconds: duration,
                     thumbUrl: nil, repsPerSet: nil, weightPerSet: nil, restPerSet: nil)
}

let twoExercises = WatchApiWorkout(
    title: "Trénink A", kind: "plan", planId: "p", dayId: nil, gymId: "g",
    dayLetter: "A", goalId: "strength",
    exercises: [makeExercise("Dřep", sets: 2), makeExercise("Tlak", sets: 1)])

let t0 = Date(timeIntervalSince1970: 1_700_000_000)

var local = LocalWorkout(workout: twoExercises, startedAt: t0)
expect(local.snapshot(now: t0).phase == .set, "a fresh workout starts on the set screen")
expect(local.snapshot(now: t0).totalSets == 2, "snapshot carries the set count")
expect(local.snapshot(now: t0).workoutTitle == "Trénink A", "snapshot carries the title")

local.logSet(weight: 40, reps: 10, now: t0)
expect(local.snapshot(now: t0).phase == .rest, "logging a set starts the rest")
expect(local.snapshot(now: t0).restEndsAt == (t0.timeIntervalSince1970 + 60) * 1000,
       "rest ends one minute later for this exercise")
expect(local.snapshot(now: t0).exercises.first?.setsDone == 1, "the list counts the logged set")

local.addRest(15)
expect(local.snapshot(now: t0).restEndsAt == (t0.timeIntervalSince1970 + 75) * 1000,
       "adding 15 s moves the end of the rest")

local.skipRest()
expect(local.snapshot(now: t0).phase == .set, "skipping the rest goes back to the set screen")
expect(local.snapshot(now: t0).setIndex == 1, "and moves to the second set")

local.logSet(weight: 42.5, reps: 8, now: t0)
local.skipRest()
expect(local.snapshot(now: t0).currentExerciseIndex == 1, "the last set moves to the next exercise")
expect(local.snapshot(now: t0).setIndex == 0, "the new exercise starts at its first set")
expect(local.snapshot(now: t0).prevWeight == nil, "the new exercise has no previous set yet")

local.logSet(weight: 60, reps: 5, now: t0)
expect(local.snapshot(now: t0).phase == .summary, "the last set of the last exercise finishes the workout")

// Pauza, která doběhne sama
var ticking = LocalWorkout(workout: twoExercises, startedAt: t0)
ticking.logSet(weight: 40, reps: 10, now: t0)
ticking.restFinishedIfDue(now: t0.addingTimeInterval(30))
expect(ticking.snapshot(now: t0).phase == .rest, "an unfinished rest keeps running")
ticking.restFinishedIfDue(now: t0.addingTimeInterval(61))
expect(ticking.snapshot(now: t0).phase == .set, "a rest that ran out advances on its own")

// Skok na cvik ze seznamu
var jumping = LocalWorkout(workout: twoExercises, startedAt: t0)
jumping.goToExercise(1)
expect(jumping.snapshot(now: t0).currentExerciseIndex == 1, "tapping the list jumps to the exercise")
jumping.goToExercise(9)
expect(jumping.snapshot(now: t0).currentExerciseIndex == 1, "an index outside the workout is ignored")
jumping.goPrevSet()
expect(jumping.snapshot(now: t0).currentExerciseIndex == 0, "back from the first set steps an exercise")

// Kardio
let cardioWorkout = WatchApiWorkout(
    title: "Vlastní", kind: "custom", planId: "p", dayId: "d", gymId: nil,
    dayLetter: nil, goalId: nil,
    exercises: [makeExercise("Pás", sets: 1, cardio: true, duration: 600)])
var localCardio = LocalWorkout(workout: cardioWorkout, startedAt: t0)
expect(localCardio.snapshot(now: t0).phase == .cardio, "a cardio exercise shows the cardio screen")
expect(localCardio.snapshot(now: t0).remainingCardioSeconds(now: t0) == 600, "cardio starts at its full length")
localCardio.toggleCardio(now: t0)
expect(localCardio.snapshot(now: t0).remainingCardioSeconds(now: t0.addingTimeInterval(100)) == 500,
       "running cardio counts down")
localCardio.toggleCardio(now: t0.addingTimeInterval(100))
expect(localCardio.snapshot(now: t0).remainingCardioSeconds(now: t0.addingTimeInterval(400)) == 500,
       "paused cardio holds its remaining time")
localCardio.toggleCardio(now: t0.addingTimeInterval(400))
expect(localCardio.snapshot(now: t0).remainingCardioSeconds(now: t0.addingTimeInterval(500)) == 400,
       "resumed cardio does not lose the paused time")

// Dotazy na watch-api
let menuReq = WatchApi.menuRequest(baseUrl: "https://x/functions/v1/watch-api", anonKey: "k", accessToken: "t")
expect(menuReq?.url?.absoluteString == "https://x/functions/v1/watch-api/menu", "menu hits /menu")
expect(menuReq?.value(forHTTPHeaderField: "Authorization") == "Bearer t", "requests carry the user token")
let customReq = WatchApi.customWorkoutRequest(baseUrl: "https://x/functions/v1/watch-api",
                                              anonKey: "k", accessToken: "t", planId: "p1", dayId: "d1")
expect(customReq?.url?.absoluteString.contains("kind=custom&planId=p1&dayId=d1") == true,
       "a custom workout asks for its plan and day")

let workoutJson = #"{"title":"Trénink A","kind":"plan","planId":"p","exercises":[{"name":"Dřep","sets":3,"repMin":8,"repMax":12,"restSeconds":120,"isCardio":false}]}"#
let decodedWorkout = WatchApi.decodeWorkout(workoutJson.data(using: .utf8)!)
expect(decodedWorkout?.exercises.count == 1, "workout json decodes its exercises")
expect(decodedWorkout?.exercises.first?.restSeconds == 120, "workout json keeps the rest length")
expect(WatchApi.decodeWorkout("nonsense".data(using: .utf8)!) == nil, "broken workout json is rejected")

let menuJson = #"{"plan":{"label":"Trénink A","dayLetter":"A","exerciseCount":6},"customDays":[{"planId":"p","dayId":"d","label":"Push Pull · Push"}]}"#
expect(WatchApi.decodeMenu(menuJson.data(using: .utf8)!)?.customDays.first?.label == "Push Pull · Push",
       "menu json decodes the custom days")

if failures > 0 { print("\(failures) failing"); exit(1) }
print("all native tests passed")
