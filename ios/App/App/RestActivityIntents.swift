import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif
#if canImport(AppIntents)
import AppIntents
import UserNotifications

// Lock-screen buttons for the workout Live Activity. LiveActivityIntent runs in
// the APP process (woken in background if needed), so it can queue events for
// the webview and flip the Live Activity natively even when JS is asleep.
// Shared file: member of BOTH the App target and PumploWidgets (the widget
// needs the types for Button(intent:)).

// ✓ on the upcoming-set card → log the set, switch to the rest countdown.
@available(iOS 17.0, *)
struct CompleteSetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Complete set"
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        let d = UserDefaults.standard
        var queue = d.array(forKey: "pumplo_pending_set_completions") as? [Double] ?? []
        queue.append(Date().timeIntervalSince1970 * 1000)
        d.set(queue, forKey: "pumplo_pending_set_completions")

        let restSec = d.double(forKey: "pumplo_pending_rest_seconds")
        if let activity = Activity<RestActivityAttributes>.activities.first {
            var state = activity.content.state
            state.mode = "rest"
            state.startedAt = Date()
            state.endsAt = Date().addingTimeInterval(max(restSec, 1))
            // Card the widget flips to when this rest expires (stale re-render).
            state.upNextName = d.string(forKey: "pumplo_next_exercise_name") ?? ""
            state.upNextSetText = d.string(forKey: "pumplo_next_set_text") ?? ""
            state.upNextDetail = d.string(forKey: "pumplo_next_detail_text") ?? ""
            state.upNextThumbPath = d.string(forKey: "pumplo_next_thumb_path") ?? ""
            // Stale exactly at rest end → native flip with the app asleep.
            await activity.update(ActivityContent(state: state, staleDate: state.endsAt))
        }
        if restSec > 0 {
            let content = UNMutableNotificationContent()
            content.title = d.string(forKey: "pumplo_rest_over_title") ?? "Pauza skončila"
            content.body = d.string(forKey: "pumplo_rest_over_body") ?? ""
            content.sound = UNNotificationSound(named: UNNotificationSoundName("rest_beep.wav"))
            if #available(iOS 15.0, *) { content.interruptionLevel = .timeSensitive }
            let req = UNNotificationRequest(
                // Same identifier the app (JS + native plugin) manages — one
                // rest-end alert regardless of who scheduled it last.
                identifier: "9911",
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(restSec, 1), repeats: false))
            try? await UNUserNotificationCenter.current().add(req)
        }
        // Wake the plugin (same process) so live JS can log the set instantly.
        NotificationCenter.default.post(name: Notification.Name("PumploSetCompleted"), object: nil)
        return .result()
    }
}

// Skip on the rest countdown → jump straight to the upcoming-set card.
@available(iOS 17.0, *)
struct SkipRestIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Skip rest"
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        let d = UserDefaults.standard
        var queue = d.array(forKey: "pumplo_pending_rest_skips") as? [Double] ?? []
        queue.append(Date().timeIntervalSince1970 * 1000)
        d.set(queue, forKey: "pumplo_pending_rest_skips")

        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["pumplo_rest_intent", "9911"])

        // Flip back to the upcoming-set card stored by the app when rest began.
        if let activity = Activity<RestActivityAttributes>.activities.first {
            var state = activity.content.state
            state.mode = "idle"
            if let name = d.string(forKey: "pumplo_next_exercise_name"), !name.isEmpty { state.exerciseName = name }
            state.nextSetText = d.string(forKey: "pumplo_next_set_text") ?? state.nextSetText
            state.detailText = d.string(forKey: "pumplo_next_detail_text") ?? ""
            state.thumbPath = d.string(forKey: "pumplo_next_thumb_path") ?? state.thumbPath
            state.startedAt = Date()
            state.endsAt = Date().addingTimeInterval(3600)
            await activity.update(ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(3600)))
        }
        NotificationCenter.default.post(name: Notification.Name("PumploRestSkipped"), object: nil)
        return .result()
    }
}
#endif
