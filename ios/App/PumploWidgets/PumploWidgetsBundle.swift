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
            // Lock screen / banner. isStale flips an expired rest countdown to
            // the next-set card natively (JS is asleep behind a locked phone).
            LockScreenRestView(state: context.state, isStale: context.isStale)
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
                    if context.state.mode == "rest" && !context.isStale {
                        Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                            .font(.caption).bold().monospacedDigit()
                            .foregroundColor(pumploCyan)
                            .frame(width: 50)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        Text(context.state.mode == "rest" && !context.isStale ? context.state.nextSetText : "\(context.state.nextSetText) · \(context.state.detailText)")
                            .font(.caption2).foregroundColor(.gray).lineLimit(1)
                        if context.state.mode == "rest" && !context.isStale {
                            ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: false)
                                .progressViewStyle(.linear).tint(pumploCyan).labelsHidden()
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundColor(pumploCyan)
            } compactTrailing: {
                if context.state.mode == "rest" && !context.isStale {
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
    var isStale: Bool = false

    // Rest expired while the app slept → show the stored next-set card.
    private var restExpired: Bool { state.mode == "rest" && isStale }
    private var showRest: Bool { state.mode == "rest" && !isStale }
    private var cardName: String {
        if restExpired { return (state.upNextName?.isEmpty == false) ? state.upNextName! : state.exerciseName }
        return state.exerciseName
    }
    private var cardSetText: String {
        if restExpired { return state.upNextSetText ?? "" }
        return state.nextSetText
    }
    private var cardDetail: String {
        if restExpired { return (state.upNextName?.isEmpty == false) ? (state.upNextDetail ?? "") : "Pauza skončila" }
        return state.detailText
    }
    private var cardThumb: String {
        if restExpired, let p = state.upNextThumbPath, !p.isEmpty { return p }
        return state.thumbPath
    }
    private var cardShowButton: Bool {
        if restExpired { return state.upNextName?.isEmpty == false }
        return state.showButton
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                ExerciseThumb(path: cardThumb)
                VStack(alignment: .leading, spacing: 2) {
                    Text(cardName)
                        .font(.headline).foregroundColor(.white).lineLimit(1)
                    if !cardSetText.isEmpty {
                        Text(cardSetText)
                            .font(.subheadline).foregroundColor(.white.opacity(0.6)).lineLimit(1)
                    }
                }
                Spacer()
                if showRest {
                    Text(timerInterval: state.startedAt...state.endsAt, countsDown: true)
                        .font(.title2).bold().monospacedDigit()
                        .foregroundColor(pumploCyan)
                        .frame(maxWidth: 70)
                }
            }
            if showRest {
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
                    Text(cardDetail)
                        .font(.title3).bold().foregroundColor(.white).lineLimit(1)
                    Spacer()
                    if cardShowButton, #available(iOS 17.0, *) {
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
