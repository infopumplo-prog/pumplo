import SwiftUI

// Jedno číselné pole. Aktivní (= to, co poslouchá korunku) má cyan rámeček,
// ťuknutím se přepne fokus na druhé.
struct SpinnerField: View {
    let title: String
    let text: String
    let isActive: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(PumploTheme.dim)
            Text(text)
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isActive ? PumploTheme.cyan : Color.clear, lineWidth: 2)
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}
