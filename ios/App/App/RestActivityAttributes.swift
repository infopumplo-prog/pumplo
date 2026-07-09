import Foundation
#if canImport(ActivityKit)
import ActivityKit

// Shared between the app target and the PumploWidgets extension (tick BOTH
// target memberships in Xcode). Everything that changes between rests lives in
// ContentState so one activity spans the whole workout via update().
@available(iOS 16.2, *)
struct RestActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startedAt: Date
        var endsAt: Date
        var exerciseName: String
        var nextSetText: String
        // "rest" = countdown; "idle" = upcoming set card with the ✓ intent button.
        var mode: String
        // e.g. "22 kg × 55" for the upcoming set (idle mode only).
        var detailText: String
        // Absolute path of the exercise thumbnail in the shared App Group
        // container ("" = none) — widgets can only render local images.
        var thumbPath: String
    }
}
#endif
