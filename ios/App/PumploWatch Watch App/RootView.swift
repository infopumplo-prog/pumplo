import SwiftUI

// Fáze určuje obrazovku. Aktivní série a pauza přijdou v dalších krocích,
// zatím se vypíše, co dorazilo — ověření, že transport funguje.
struct RootView: View {
    @StateObject private var connector = WatchConnector()

    var body: some View {
        ZStack {
            PumploTheme.navy.ignoresSafeArea()
            content
        }
        .onAppear { connector.activate() }
    }

    @ViewBuilder private var content: some View {
        if !connector.hasSnapshot {
            WaitingView()
        } else {
            switch connector.snapshot.phase {
            case .set:
                VStack(spacing: 4) {
                    Text(connector.snapshot.exerciseName)
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.white)
                    Text(connector.snapshot.headerLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(PumploTheme.cyan)
                }
            case .rest:
                Text(WatchFormat.clock(connector.snapshot.remainingSeconds()))
                    .font(.system(size: 26, weight: .black))
                    .foregroundStyle(.white)
            case .summary:
                DoneView()
            case .idle:
                WaitingView()
            }
        }
    }
}
