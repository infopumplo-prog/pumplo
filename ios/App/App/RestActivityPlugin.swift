import Foundation
import Capacitor
import UserNotifications
#if canImport(ActivityKit)
import ActivityKit
#endif

// Lock-screen Live Activity for the workout. Two modes:
//  - "idle": upcoming set card (exercise, set, kg × reps) with a ✓ App Intent
//    button (iOS 17+) that completes the set straight from the lock screen;
//  - "rest": system-rendered countdown (Text(timerInterval:)).
// JS only pushes state changes; the countdown itself never needs updates.
// Silent no-op below iOS 16.2 or when the user disabled Live Activities.
@objc(RestActivityPlugin)
public class RestActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestActivityPlugin"
    public let jsName = "RestActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePending", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        // Fired by CompleteSetIntent (same process) — forward to JS listeners.
        NotificationCenter.default.addObserver(forName: Notification.Name("PumploSetCompleted"), object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("setCompleted", data: [:])
        }
    }

    // Rest countdown (also cancels the intent-armed rest-end notification —
    // when JS is awake it owns the rest alert with its own audio/notification).
    @objc func start(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["pumplo_rest_intent"])
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
        let state = RestActivityPlugin.restState(from: call)
        Task {
            await RestActivityPlugin.startOrUpdate(state)
            call.resolve()
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            guard let activity = Activity<RestActivityAttributes>.activities.first else { call.resolve(); return }
            var state = activity.content.state
            let endsAtMs = call.getDouble("endsAt") ?? state.endsAt.timeIntervalSince1970 * 1000
            state.endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
            if let next = call.getString("nextSetText") { state.nextSetText = next }
            await activity.update(ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(180)))
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["pumplo_rest_intent"])
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for activity in Activity<RestActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    // Upcoming-set card. Also records what the lock-screen ✓ should do
    // (rest length + notification copy) for CompleteSetIntent.
    @objc func showSet(_ call: CAPPluginCall) {
        let d = UserDefaults.standard
        d.set(call.getDouble("restSeconds") ?? 0, forKey: "pumplo_pending_rest_seconds")
        if let title = call.getString("restOverTitle") { d.set(title, forKey: "pumplo_rest_over_title") }
        if let body = call.getString("restOverBody") { d.set(body, forKey: "pumplo_rest_over_body") }

        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
        let now = Date()
        let state = RestActivityAttributes.ContentState(
            startedAt: now,
            endsAt: now.addingTimeInterval(3600), // unused in idle mode
            exerciseName: call.getString("exerciseName") ?? "",
            nextSetText: call.getString("setText") ?? "",
            mode: "idle",
            detailText: call.getString("detailText") ?? "")
        Task {
            await RestActivityPlugin.startOrUpdate(state, staleAfter: 3600)
            call.resolve()
        }
    }

    // Set completions queued by the intent while the webview slept.
    @objc func consumePending(_ call: CAPPluginCall) {
        let d = UserDefaults.standard
        let queue = d.array(forKey: "pumplo_pending_set_completions") as? [Double] ?? []
        d.removeObject(forKey: "pumplo_pending_set_completions")
        call.resolve(["completions": queue])
    }

    @available(iOS 16.2, *)
    private static func startOrUpdate(_ state: RestActivityAttributes.ContentState, staleAfter: TimeInterval = 180) async {
        let content = ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(staleAfter))
        if let existing = Activity<RestActivityAttributes>.activities.first {
            await existing.update(content)
        } else {
            _ = try? Activity<RestActivityAttributes>.request(attributes: RestActivityAttributes(), content: content)
        }
    }

    @available(iOS 16.2, *)
    private static func restState(from call: CAPPluginCall) -> RestActivityAttributes.ContentState {
        let endsAtMs = call.getDouble("endsAt") ?? Date().timeIntervalSince1970 * 1000
        let totalSeconds = call.getDouble("totalSeconds") ?? 0
        let endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
        return RestActivityAttributes.ContentState(
            startedAt: endsAt.addingTimeInterval(-max(totalSeconds, 1)),
            endsAt: endsAt,
            exerciseName: call.getString("exerciseName") ?? "",
            nextSetText: call.getString("nextSetText") ?? "",
            mode: "rest",
            detailText: "")
    }
}
