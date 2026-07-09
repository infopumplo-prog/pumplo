import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif
#if canImport(AppIntents)
import AppIntents
import UserNotifications

// Lock-screen ✓ button: completes the upcoming set. LiveActivityIntent runs in
// the APP process (woken in background if needed), so it can queue the event
// for the webview, flip the Live Activity into a rest countdown natively and
// arm a rest-end notification in case the webview stays asleep.
// Shared file: member of BOTH the App target and PumploWidgets (the widget
// needs the type for Button(intent:)).
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
            await activity.update(ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(180)))
        }
        if restSec > 0 {
            let content = UNMutableNotificationContent()
            content.title = d.string(forKey: "pumplo_rest_over_title") ?? "Pauza skončila"
            content.body = d.string(forKey: "pumplo_rest_over_body") ?? ""
            content.sound = .default
            let req = UNNotificationRequest(
                identifier: "pumplo_rest_intent",
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(restSec, 1), repeats: false))
            try? await UNUserNotificationCenter.current().add(req)
        }
        // Wake the plugin (same process) so live JS can log the set instantly.
        NotificationCenter.default.post(name: Notification.Name("PumploSetCompleted"), object: nil)
        return .result()
    }
}
#endif
