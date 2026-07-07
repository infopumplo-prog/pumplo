import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

// Lock-screen Live Activity for the rest timer. The system renders the
// countdown (Text(timerInterval:)) so we only push updates on rest lifecycle
// changes. Silent no-op below iOS 16.2 or when the user disabled Live
// Activities.
@objc(RestActivityPlugin)
public class RestActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestActivityPlugin"
    public let jsName = "RestActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
        let state = RestActivityPlugin.contentState(from: call)
        Task {
            if let existing = Activity<RestActivityAttributes>.activities.first {
                await existing.update(ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(180)))
            } else {
                _ = try? Activity<RestActivityAttributes>.request(
                    attributes: RestActivityAttributes(),
                    content: ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(180)))
            }
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
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for activity in Activity<RestActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private static func contentState(from call: CAPPluginCall) -> RestActivityAttributes.ContentState {
        let endsAtMs = call.getDouble("endsAt") ?? Date().timeIntervalSince1970 * 1000
        let totalSeconds = call.getDouble("totalSeconds") ?? 0
        let endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
        return RestActivityAttributes.ContentState(
            startedAt: endsAt.addingTimeInterval(-max(totalSeconds, 1)),
            endsAt: endsAt,
            exerciseName: call.getString("exerciseName") ?? "",
            nextSetText: call.getString("nextSetText") ?? "")
    }
}
