import SwiftUI
import WatchKit

// Jedno číselné pole. Aktivní (= to, co poslouchá korunku) má cyan rámeček,
// ťuknutím se přepne fokus na druhé.
//
// Kromě korunky pole poslouchá svislé tažení prstem. Pole samo neví, co
// hodnota znamená — jen hlásí ven, o kolik KROKŮ se má posunout (onDelta).
// Kroky se během jednoho gesta počítají od jeho začátku a odesílá se vždy jen
// rozdíl proti tomu, co už bylo poslané, takže pomalý tah po jednom kroku
// funguje stejně jako rychlý přejezd.
struct SpinnerField: View {
    let title: String
    let text: String
    let isActive: Bool
    let onTap: () -> Void
    let onDelta: (Int) -> Void

    @State private var sentSteps = 0

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
        // minimumDistance 3 nechá krátké ťuknutí projít jako tap, ne jako tah.
        // highPriorityGesture, aby tah po poli nesebralo rolování obrazovky —
        // ActiveSetView je kvůli navigační liště ve ScrollView.
        .highPriorityGesture(
            DragGesture(minimumDistance: 3)
                .onChanged { value in
                    // Tah zároveň převezme fokus, aby korunka i prst vždycky
                    // ovládaly totéž pole.
                    if !isActive { onTap() }
                    let steps = DragStepper.totalSteps(translationHeight: value.translation.height)
                    let delta = steps - sentSteps
                    guard delta != 0 else { return }
                    sentSteps = steps
                    onDelta(delta)
                    WKInterfaceDevice.current().play(.click)
                }
                .onEnded { _ in sentSteps = 0 }
        )
    }
}
