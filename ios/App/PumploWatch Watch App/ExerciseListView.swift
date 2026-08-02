import SwiftUI

// Seznam cviků tréninku — kořen hodinkové appky, když trénink běží. Ťuknutí na
// řádek přepne cvik i v telefonu a otevře detail; šipkou zpět se sem uživatel
// kdykoliv vrátí.
//
// Náhledy se stahují přímo z veřejné adresy v Supabase, ne přes telefon —
// obrázek přes WatchConnectivity by byl pomalý a zbytečný.
struct ExerciseListView: View {
    let snapshot: WatchWorkoutSnapshot
    let currentIndex: Int
    let onSelect: (Int) -> Void

    @State private var elapsed = 0

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        List {
            Section {
                ForEach(Array(snapshot.exercises.enumerated()), id: \.offset) { index, item in
                    Button { onSelect(index) } label: {
                        row(item, isCurrent: index == currentIndex)
                    }
                    .listRowBackground(Color.clear)
                }
            } header: {
                header
            }
        }
        .onAppear { elapsed = snapshot.elapsedSeconds() }
        .onReceive(ticker) { _ in elapsed = snapshot.elapsedSeconds() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(snapshot.workoutTitle)
                .font(.system(size: 13, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(1)
            Text(WatchFormat.clock(elapsed))
                .font(.system(size: 12, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(PumploTheme.cyan)
        }
        .textCase(nil)
    }

    private func row(_ item: WatchExerciseItem, isCurrent: Bool) -> some View {
        HStack(spacing: 8) {
            thumb(item)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.name)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.leading)
                Text(item.progressLabel)
                    .font(.system(size: 10))
                    .foregroundStyle(item.isDone ? PumploTheme.cyan : PumploTheme.dim)
            }
            Spacer(minLength: 0)
            if item.isDone {
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(PumploTheme.cyan)
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 6)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isCurrent ? PumploTheme.cyan : Color.clear, lineWidth: 2)
        )
    }

    // Když se obrázek nestáhne (hodinky bez sítě), zůstane šedý čtvereček —
    // seznam kvůli němu nesmí zamrznout ani zůstat prázdný.
    private func thumb(_ item: WatchExerciseItem) -> some View {
        let placeholder = RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.12))
            .overlay(Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 14))
                .foregroundStyle(PumploTheme.dim))

        return Group {
            if let urlString = item.thumbUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    placeholder
                }
            } else {
                placeholder
            }
        }
        .frame(width: 34, height: 34)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
