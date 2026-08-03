import SwiftUI

// Trénink neběží nebo ještě nepřišel první snapshot z telefonu.
struct WaitingView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "iphone.gen3")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(PumploTheme.cyan)
            Text("Čekám na telefon")
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(.white)
            Text("Spusť trénink v Pumplu")
                .font(.system(size: 11))
                .foregroundStyle(PumploTheme.dim)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 8)
    }
}

// Hodinky zatím nedostaly přihlášení, nebo propadlo. Samostatný režim bez něj
// nemá jak sáhnout na server — a tiché prázdno je horší než jasná věta.
struct SignedOutView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(PumploTheme.cyan)
            Text("Přihlas se v telefonu")
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text("Otevři Pumplo v telefonu, hodinky si přihlášení převezmou samy")
                .font(.system(size: 10))
                .foregroundStyle(PumploTheme.dim)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 8)
    }
}

// Trénink dokončen (phase == summary). V samostatném režimu ukazuje stav
// ukládání a tlačítko zpět na nabídku; v zrcadlovém režimu ukládá telefon,
// takže se nic z toho nezobrazuje (statusText i onClose jsou nil).
struct DoneView: View {
    var statusText: String? = nil
    var onClose: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(PumploTheme.cyan)
            Text("Hotovo!")
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(.white)
            Text(statusText ?? "Trénink máš za sebou")
                .font(.system(size: 11))
                .foregroundStyle(PumploTheme.dim)
                .multilineTextAlignment(.center)
            if let onClose {
                Button("Zavřít", action: onClose)
                    .font(.system(size: 13, weight: .bold))
                    .tint(PumploTheme.cyan)
                    .padding(.top, 4)
            }
        }
    }
}
