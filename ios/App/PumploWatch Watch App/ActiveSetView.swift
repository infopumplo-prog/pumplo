import SwiftUI

// Aktivní série. Korunku dostane pole, které má fokus — proto má každé pole
// vlastní .digitalCrownRotation; přepnutí je jen změna @FocusState.
struct ActiveSetView: View {
    let snapshot: WatchWorkoutSnapshot
    let onLog: (Double, Int) -> Void
    let onPrev: () -> Void
    let onNext: () -> Void

    private enum Field: Hashable { case weight, reps }

    @State private var weight: Double = 0
    @State private var reps: Double = 0
    @FocusState private var focused: Field?

    var body: some View {
        VStack(spacing: 5) {
            Text(snapshot.exerciseName)
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.center)

            Text(snapshot.headerLabel)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(PumploTheme.cyan)
                .lineLimit(1)

            HStack(spacing: 6) {
                SpinnerField(title: "KG",
                             text: WatchFormat.weight(weight),
                             isActive: focused == .weight) { focused = .weight }
                    .focusable()
                    .focused($focused, equals: .weight)
                    .digitalCrownRotation($weight, from: 0, through: 500, by: snapshot.stepValue,
                                          sensitivity: .medium, isContinuous: false,
                                          isHapticFeedbackEnabled: true)

                SpinnerField(title: "OPAK.",
                             text: "\(Int(reps))",
                             isActive: focused == .reps) { focused = .reps }
                    .focusable()
                    .focused($focused, equals: .reps)
                    .digitalCrownRotation($reps, from: 1, through: 100, by: 1,
                                          sensitivity: .medium, isContinuous: false,
                                          isHapticFeedbackEnabled: true)
            }

            Text(snapshot.targetLine)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(PumploTheme.dim)
                .lineLimit(1)

            if let previousLine = snapshot.previousLine {
                Text(previousLine)
                    .font(.system(size: 10))
                    .foregroundStyle(PumploTheme.dim)
                    .lineLimit(1)
            }

            HStack(spacing: 6) {
                Button(action: onPrev) {
                    Image(systemName: "chevron.left").font(.system(size: 14, weight: .bold))
                }
                .buttonStyle(.bordered)
                .tint(.white.opacity(0.2))

                Button { onLog(weight, Int(reps)) } label: {
                    Image(systemName: "checkmark").font(.system(size: 18, weight: .black))
                }
                .buttonStyle(.borderedProminent)
                .tint(PumploTheme.cyan)

                Button(action: onNext) {
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .bold))
                }
                .buttonStyle(.bordered)
                .tint(.white.opacity(0.2))
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 4)
        .onAppear { seed() }
        // Předvyplnění se obnoví jen při změně cviku/série — rozepsanou hodnotu
        // uprostřed série by přepsání zahodilo.
        .onChange(of: seedKey) { _, _ in seed() }
    }

    private var seedKey: String { "\(snapshot.exerciseName)#\(snapshot.setIndex)" }

    private func seed() {
        weight = snapshot.prefillWeight
        reps = Double(snapshot.prefillReps)
        focused = .weight
    }
}
