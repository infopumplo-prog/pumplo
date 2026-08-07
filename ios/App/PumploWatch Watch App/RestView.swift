import SwiftUI
import WatchKit

// Pauza. Zbývající čas se počítá z restEndsAt lokálně (telefon posílá jen
// koncový čas), takže výpadek spojení odpočet nezastaví ani neresetuje.
struct RestView: View {
    let snapshot: WatchWorkoutSnapshot
    let onAdd15: () -> Void
    let onSkip: () -> Void

    @State private var remaining = 0
    @State private var total = 0
    @State private var lastTick = -1

    private let ticker = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.15), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(PumploTheme.cyan, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(WatchFormat.clock(remaining))
                    .font(.system(size: 24, weight: .black))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
            .frame(width: 82, height: 82)

            Text(caption)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(PumploTheme.cyan)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            HStack(spacing: 6) {
                Button("+15 s", action: onAdd15)
                    .buttonStyle(.bordered)
                    .tint(.white.opacity(0.2))
                Button("Přeskočit", action: onSkip)
                    .buttonStyle(.borderedProminent)
                    .tint(PumploTheme.cyan)
            }
            .font(.system(size: 12, weight: .bold))
        }
        .padding(.horizontal, 4)
        .onAppear { tick() }
        .onReceive(ticker) { _ in tick() }
        // Nová pauza i +15 s mění koncový čas → prstenec začne znovu plný.
        .onChange(of: snapshot.restEndsAt) { _, _ in
            total = 0
            lastTick = -1
            tick()
        }
    }

    private var caption: String {
        guard let label = snapshot.nextSetLabel, !label.isEmpty else { return "Pauza" }
        return "Pauza · pak \(label)"
    }

    private var progress: CGFloat {
        guard total > 0 else { return 0 }
        return CGFloat(remaining) / CGFloat(total)
    }

    private func tick() {
        let value = snapshot.remainingSeconds()
        remaining = value
        total = max(total, value)

        guard value != lastTick else { return }
        let firstTick = lastTick < 0
        lastTick = value
        // Při prvním vykreslení se nehraje nic — jinak by appka otevřená
        // po skončení pauzy hned zavibrovala.
        guard !firstTick else { return }
        if value > 0 && value <= 3 { WKInterfaceDevice.current().play(.click) }
        if value == 0 { WKInterfaceDevice.current().play(.notification) }
    }
}
