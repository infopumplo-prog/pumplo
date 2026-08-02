import SwiftUI

// Nabídka tréninků. Hodinky trénink nespouštějí samy — jen řeknou telefonu,
// co otevřít, a čekají, až dorazí snapshot. Když nedorazí, řeknou to nahlas.
struct MenuView: View {
    let menu: WatchMenu
    let startState: WatchConnector.StartState
    let onStart: (WatchMenuItem) -> Void
    let onRetry: () -> Void
    let onTick: () -> Void

    private let ticker = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            switch startState {
            case .sending:
                VStack(spacing: 8) {
                    ProgressView().tint(PumploTheme.cyan)
                    Text("Spouštím…")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                }
            case .failed(let reason):
                VStack(spacing: 6) {
                    Image(systemName: "iphone.gen3.slash")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(PumploTheme.cyan)
                    Text(reason)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Button("Zkusit znovu", action: onRetry)
                        .buttonStyle(.borderedProminent)
                        .tint(PumploTheme.cyan)
                        .font(.system(size: 12, weight: .bold))
                }
                .padding(.horizontal, 6)
            case .idle:
                list
            }
        }
        .onReceive(ticker) { _ in onTick() }
    }

    private var list: some View {
        List {
            ForEach(menu.items) { item in
                Button { onStart(item) } label: {
                    HStack(spacing: 6) {
                        Image(systemName: icon(for: item.kind))
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(PumploTheme.cyan)
                        Text(item.label)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                }
            }
            // Seznam se nikdy neuřízne potichu.
            if menu.truncated {
                Text("Další v telefonu")
                    .font(.system(size: 11))
                    .foregroundStyle(PumploTheme.dim)
            }
        }
    }

    private func icon(for kind: String) -> String {
        switch kind {
        case "resume": return "play.circle.fill"
        case "plan": return "calendar"
        default: return "list.bullet"
        }
    }
}
