import WidgetKit
import SwiftUI
import ActivityKit
import AppIntents

@main
struct PumploWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RestActivityWidget()
    }
}

private let pumploCyan = Color(red: 0x4C / 255, green: 0xC9 / 255, blue: 0xFF / 255)

struct RestActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            // Lock screen / banner
            LockScreenRestView(state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.exerciseName)
                        .font(.caption).bold().foregroundColor(.white)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                        .font(.caption).bold().monospacedDigit()
                        .foregroundColor(pumploCyan)
                        .frame(width: 50)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        Text(context.state.nextSetText)
                            .font(.caption2).foregroundColor(.gray).lineLimit(1)
                        ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: false)
                            .progressViewStyle(.linear).tint(pumploCyan).labelsHidden()
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundColor(pumploCyan)
            } compactTrailing: {
                Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                    .font(.caption2).monospacedDigit().foregroundColor(pumploCyan)
                    .frame(width: 40)
            } minimal: {
                Image(systemName: "timer").foregroundColor(pumploCyan)
            }
        }
    }
}

struct LockScreenRestView: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundColor(pumploCyan)
                Text("Pumplo").font(.caption).bold().foregroundColor(.white.opacity(0.7))
                Spacer()
                if state.mode == "rest" {
                    Text(timerInterval: state.startedAt...state.endsAt, countsDown: true)
                        .font(.title2).bold().monospacedDigit()
                        .foregroundColor(pumploCyan)
                        .frame(maxWidth: 70)
                }
            }
            Text(state.exerciseName)
                .font(.headline).foregroundColor(.white).lineLimit(1)
            if !state.nextSetText.isEmpty {
                Text(state.nextSetText)
                    .font(.subheadline).foregroundColor(.white.opacity(0.6)).lineLimit(1)
            }
            if state.mode == "rest" {
                ProgressView(timerInterval: state.startedAt...state.endsAt, countsDown: false)
                    .progressViewStyle(.linear).tint(pumploCyan).labelsHidden()
            } else {
                // Upcoming set: kg × reps + lock-screen ✓ (completes the set)
                HStack {
                    Text(state.detailText)
                        .font(.title3).bold().foregroundColor(.white).lineLimit(1)
                    Spacer()
                    if #available(iOS 17.0, *) {
                        Button(intent: CompleteSetIntent()) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.black)
                                .frame(width: 44, height: 34)
                        }
                        .buttonStyle(.plain)
                        .background(pumploCyan)
                        .cornerRadius(10)
                    }
                }
            }
        }
        .padding(14)
    }
}
