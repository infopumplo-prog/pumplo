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

// Trénink dokončen (phase == summary).
struct DoneView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(PumploTheme.cyan)
            Text("Hotovo!")
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(.white)
            Text("Trénink máš za sebou")
                .font(.system(size: 11))
                .foregroundStyle(PumploTheme.dim)
        }
    }
}
