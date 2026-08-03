import SwiftUI
import WatchKit

// Kardio cvik ve vlastním tréninku. Zbývající čas se počítá z razítek, která
// posílá telefon — při pauze od okamžiku pauzy, jinak od teď. Výpadek spojení
// tedy odpočet nezastaví ani neresetuje.
struct CardioView: View {
    let snapshot: WatchWorkoutSnapshot
    let onToggle: () -> Void
    let onDone: () -> Void
    // Jen u rozcvičky/cooldownu: přeskočí celou sekci, ne jednu položku.
    var onSkipAll: (() -> Void)? = nil

    @State private var remaining = 0
    @State private var total = 0
    @State private var lastTick = -1

    private let ticker = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 5) {
            Text(snapshot.exerciseName)
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.center)

            ZStack {
                Circle().stroke(Color.white.opacity(0.15), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(PumploTheme.cyan, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(WatchFormat.clock(remaining))
                    .font(.system(size: 22, weight: .black))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
            .frame(width: 74, height: 74)

            HStack(spacing: 6) {
                Button(action: onToggle) {
                    Image(systemName: snapshot.isCardioPaused ? "play.fill" : "pause.fill")
                        .font(.system(size: 16, weight: .black))
                }
                .buttonStyle(.borderedProminent)
                .tint(PumploTheme.cyan)

                Button("Hotovo", action: onDone)
                    .buttonStyle(.bordered)
                    .tint(.white.opacity(0.2))
                    .font(.system(size: 12, weight: .bold))
            }

            if let onSkipAll {
                Button("Přeskočit vše", action: onSkipAll)
                    .buttonStyle(.plain)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(PumploTheme.dim)
            }
        }
        .padding(.horizontal, 4)
        .onAppear { tick() }
        .onReceive(ticker) { _ in tick() }
        .onChange(of: snapshot.cardioEndsAt) { _, _ in
            total = 0
            lastTick = -1
            tick()
        }
    }

    private var progress: CGFloat {
        guard total > 0 else { return 0 }
        return CGFloat(remaining) / CGFloat(total)
    }

    private func tick() {
        let value = snapshot.remainingCardioSeconds()
        remaining = value
        total = max(total, max(value, snapshot.cardioTotalSeconds))

        guard value != lastTick else { return }
        let firstTick = lastTick < 0
        lastTick = value
        // Při prvním vykreslení a při pauze se nehraje nic.
        guard !firstTick, !snapshot.isCardioPaused else { return }
        if value > 0 && value <= 3 { WKInterfaceDevice.current().play(.click) }
        if value == 0 { WKInterfaceDevice.current().play(.notification) }
    }
}
