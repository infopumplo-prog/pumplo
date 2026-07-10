import Foundation
import Capacitor
import UserNotifications
#if canImport(ActivityKit)
import ActivityKit
#endif

// Lock-screen Live Activity for the workout. Two modes:
//  - "idle": upcoming set card (thumb, exercise, set, kg × reps) with a ✓ App
//    Intent button (iOS 17+) that completes the set from the lock screen;
//  - "rest": system-rendered countdown with a Skip intent button.
// JS only pushes state changes; the countdown itself never needs updates.
// Exercise thumbnails are downloaded into the App Group container because
// widgets can only render local images.
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

    static let appGroup = "group.com.pumplo.app"

    public override func load() {
        // Fired by the lock-screen intents (same process) — forward to JS.
        NotificationCenter.default.addObserver(forName: Notification.Name("PumploSetCompleted"), object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("setCompleted", data: [:])
        }
        NotificationCenter.default.addObserver(forName: Notification.Name("PumploRestSkipped"), object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("restSkipped", data: [:])
        }
    }

    // Rest countdown. Also stores the UPCOMING set card (nextSet…) so the
    // lock-screen Skip intent can flip back to it natively, and cancels the
    // intent-armed rest-end notification (awake JS owns the alert).
    @objc func start(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["pumplo_rest_intent"])
        let d = UserDefaults.standard
        // Callers that don't know the upcoming set (bare rest re-arms) must not
        // blank the stored card the lock-screen Skip intent flips back to.
        let nextName = call.getString("nextExerciseName") ?? ""
        let nextSetText = call.getString("nextSetOfText") ?? ""
        if !nextName.isEmpty || !nextSetText.isEmpty {
            d.set(nextName, forKey: "pumplo_next_exercise_name")
            d.set(nextSetText, forKey: "pumplo_next_set_text")
            d.set(call.getString("nextDetailText") ?? "", forKey: "pumplo_next_detail_text")
        }
        let nextRest = call.getDouble("nextRestSeconds") ?? 0
        if nextRest > 0 { d.set(nextRest, forKey: "pumplo_pending_rest_seconds") }

        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
        let thumbUrl = call.getString("thumbUrl")
        let nextThumbUrl = call.getString("nextThumbUrl")
        Task {
            let thumbPath = await RestActivityPlugin.localThumb(for: thumbUrl)
            if let nextThumbUrl, !nextThumbUrl.isEmpty {
                let nextThumbPath = await RestActivityPlugin.localThumb(for: nextThumbUrl)
                UserDefaults.standard.set(nextThumbPath ?? "", forKey: "pumplo_next_thumb_path")
            }
            var state = RestActivityPlugin.restState(from: call)
            state.thumbPath = thumbPath ?? ""
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
        let thumbUrl = call.getString("thumbUrl")
        let now = Date()
        var state = RestActivityAttributes.ContentState(
            startedAt: now,
            endsAt: now.addingTimeInterval(3600), // unused in idle mode
            exerciseName: call.getString("exerciseName") ?? "",
            nextSetText: call.getString("setText") ?? "",
            mode: "idle",
            detailText: call.getString("detailText") ?? "",
            thumbPath: "",
            showButton: call.getBool("showButton") ?? true)
        Task {
            state.thumbPath = await RestActivityPlugin.localThumb(for: thumbUrl) ?? ""
            await RestActivityPlugin.startOrUpdate(state, staleAfter: 3600)
            call.resolve()
        }
    }

    // Events queued by the lock-screen intents while the webview slept.
    @objc func consumePending(_ call: CAPPluginCall) {
        let d = UserDefaults.standard
        let completions = d.array(forKey: "pumplo_pending_set_completions") as? [Double] ?? []
        let skips = d.array(forKey: "pumplo_pending_rest_skips") as? [Double] ?? []
        d.removeObject(forKey: "pumplo_pending_set_completions")
        d.removeObject(forKey: "pumplo_pending_rest_skips")
        call.resolve(["completions": completions, "skips": skips])
    }

    // Download (once) an exercise thumbnail into the App Group container so the
    // widget process can render it. Returns the local path, or nil.
    private static func localThumb(for urlString: String?) async -> String? {
        guard let urlString, !urlString.isEmpty, let url = URL(string: urlString) else { return nil }
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let dir = container.appendingPathComponent("thumbs", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let name = String(abs(urlString.hashValue)) + ".jpg"
        let file = dir.appendingPathComponent(name)
        if FileManager.default.fileExists(atPath: file.path) { return file.path }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            try data.write(to: file)
            return file.path
        } catch { return nil }
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
            detailText: "",
            thumbPath: "",
            showButton: true)
    }
}
