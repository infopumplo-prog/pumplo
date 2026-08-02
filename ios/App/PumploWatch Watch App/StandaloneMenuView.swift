import SwiftUI

// Nabídka tréninků staženvá z watch-api. Na rozdíl od MenuView tady telefon
// nehraje roli — ťuknutí stáhne trénink rovnou do hodinek.
struct StandaloneMenuView: View {
    let menu: WatchApiMenu
    let isLoading: Bool
    let error: String?
    let onPlan: () -> Void
    let onCustom: (WatchApiMenuDay) -> Void
    let onRetry: () -> Void

    var body: some View {
        if isLoading {
            VStack(spacing: 8) {
                ProgressView().tint(PumploTheme.cyan)
                Text("Stahuju trénink…")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
            }
        } else if let error {
            VStack(spacing: 6) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(PumploTheme.cyan)
                Text(error)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Button("Zkusit znovu", action: onRetry)
                    .buttonStyle(.borderedProminent)
                    .tint(PumploTheme.cyan)
                    .font(.system(size: 12, weight: .bold))
            }
            .padding(.horizontal, 6)
        } else {
            list
        }
    }

    private var list: some View {
        List {
            if let plan = menu.plan {
                Button(action: onPlan) {
                    row(icon: "calendar", title: plan.label,
                        subtitle: "\(plan.exerciseCount) cviků")
                }
            }
            ForEach(menu.customDays, id: \.dayId) { day in
                Button { onCustom(day) } label: {
                    row(icon: "list.bullet", title: day.label, subtitle: nil)
                }
            }
        }
    }

    private func row(icon: String, title: String, subtitle: String?) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(PumploTheme.cyan)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 10))
                        .foregroundStyle(PumploTheme.dim)
                }
            }
            Spacer(minLength: 0)
        }
    }
}
