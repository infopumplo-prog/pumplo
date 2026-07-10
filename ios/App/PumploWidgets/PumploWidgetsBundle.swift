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

// Small square exercise thumbnail (first video frame) from the App Group
// container; falls back to an SF Symbol when missing.
private struct ExerciseThumb: View {
    let path: String

    var body: some View {
        Group {
            if !path.isEmpty, let ui = UIImage(contentsOfFile: path) {
                Image(uiImage: ui).resizable().scaledToFill()
            } else {
                ZStack {
                    Color.white.opacity(0.1)
                    Image(systemName: "figure.strengthtraining.traditional")
                        .foregroundColor(pumploCyan)
                }
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

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
                    if context.state.mode == "rest" {
                        Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                            .font(.caption).bold().monospacedDigit()
                            .foregroundColor(pumploCyan)
                            .frame(width: 50)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        Text(context.state.mode == "rest" ? context.state.nextSetText : "\(context.state.nextSetText) · \(context.state.detailText)")
                            .font(.caption2).foregroundColor(.gray).lineLimit(1)
                        if context.state.mode == "rest" {
                            ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: false)
                                .progressViewStyle(.linear).tint(pumploCyan).labelsHidden()
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundColor(pumploCyan)
            } compactTrailing: {
                if context.state.mode == "rest" {
                    Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                        .font(.caption2).monospacedDigit().foregroundColor(pumploCyan)
                        .frame(width: 40)
                } else {
                    Image(systemName: "dumbbell").foregroundColor(pumploCyan)
                }
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
            HStack(spacing: 10) {
                ExerciseThumb(path: state.thumbPath)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.exerciseName)
                        .font(.headline).foregroundColor(.white).lineLimit(1)
                    if !state.nextSetText.isEmpty {
                        Text(state.nextSetText)
                            .font(.subheadline).foregroundColor(.white.opacity(0.6)).lineLimit(1)
                    }
                }
                Spacer()
                if state.mode == "rest" {
                    Text(timerInterval: state.startedAt...state.endsAt, countsDown: true)
                        .font(.title2).bold().monospacedDigit()
                        .foregroundColor(pumploCyan)
                        .frame(maxWidth: 70)
                }
            }
            if state.mode == "rest" {
                HStack(spacing: 10) {
                    ProgressView(timerInterval: state.startedAt...state.endsAt, countsDown: false)
                        .progressViewStyle(.linear).tint(pumploCyan).labelsHidden()
                    if #available(iOS 17.0, *) {
                        Button(intent: SkipRestIntent()) {
                            Text("Skip")
                                .font(.caption).bold()
                                .foregroundColor(.black)
                                .padding(.horizontal, 12).padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)
                        .background(pumploCyan)
                        .cornerRadius(9)
                    }
                }
            } else {
                // Upcoming set: kg × reps + an EMPTY checkbox that "ticks" the set
                HStack {
                    Text(state.detailText)
                        .font(.title3).bold().foregroundColor(.white).lineLimit(1)
                    Spacer()
                    if state.showButton, #available(iOS 17.0, *) {
                        Button(intent: CompleteSetIntent()) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(pumploCyan, lineWidth: 2)
                                    .frame(width: 44, height: 34)
                                Image(systemName: "checkmark")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(.white.opacity(0.35))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(14)
    }
}
