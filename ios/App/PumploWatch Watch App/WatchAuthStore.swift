import Foundation
import Security

// Držení přihlášení na hodinkách: Keychain + obnova přístupu proti Supabase.
// Rozhodovací logika (kdy obnovit, jak zparsovat odpověď) je ve WatchAuth,
// aby šla testovat harnessem; tady zůstává jen to, co potřebuje zařízení.
@MainActor
final class WatchAuthStore: ObservableObject {
    enum State: Equatable {
        case unknown      // ještě jsme se nepodívali do Keychainu
        case signedOut    // telefon zatím nic nepředal, nebo přihlášení propadlo
        case signedIn
    }

    @Published private(set) var state: State = .unknown

    private var token: WatchAuthToken?
    private var refreshTask: Task<String, Error>?

    private let service = "com.pumplo.app.watchkitapp"
    private let account = "supabase-session"

    func load() {
        token = readKeychain()
        state = token == nil ? .signedOut : .signedIn
    }

    // Relace předaná telefonem (transferUserInfo). Přepíše cokoliv, co tu bylo.
    func accept(_ next: WatchAuthToken) {
        token = next
        writeKeychain(next)
        state = .signedIn
    }

    // Odhlášení v telefonu musí zneplatnit i hodinky — token je plnohodnotné
    // přihlášení a bez tohohle by na zápěstí přežil odhlášení.
    func clear() {
        token = nil
        deleteKeychain()
        state = .signedOut
    }

    var userId: String? { token?.userId }

    /// Platný přístupový token; obnoví ho, když je blízko vypršení.
    /// Souběžná volání sdílí jednu obnovu — jinak by dvě obrazovky naráz
    /// vypálily dvě rotace a jedna by tu druhou zneplatnila.
    func validAccessToken() async throws -> String {
        guard let current = token else { throw WatchAuthError.signedOut }
        guard WatchAuth.needsRefresh(expiresAt: current.expiresAt, now: Date().timeIntervalSince1970) else {
            return current.accessToken
        }
        if let refreshTask { return try await refreshTask.value }

        let task = Task<String, Error> { [weak self] in
            guard let self else { throw WatchAuthError.signedOut }
            return try await self.performRefresh(current)
        }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }

    /// Kontrola při otevření appky: platí přihlášení ještě? Odvolanou relaci
    /// (odhlášení v telefonu, změna hesla) je lepší poznat hned než až ve
    /// chvíli, kdy chce uživatel začít cvičit.
    func verifyAccess() async {
        guard state == .signedIn else { return }
        do {
            let accessToken = try await validAccessToken()
            guard let url = URL(string: "\(WatchConfig.supabaseUrl)/auth/v1/user") else { return }
            var request = URLRequest(url: url)
            request.setValue(WatchConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            let (_, response) = try await URLSession.shared.data(for: request)
            if (response as? HTTPURLResponse)?.statusCode == 401 { clear() }
        } catch WatchAuthError.signedOut {
            // performRefresh už uklidil.
        } catch {
            // Síť zlobí — to není důvod odhlašovat. Zkusí se příště.
        }
    }

    private func performRefresh(_ current: WatchAuthToken) async throws -> String {
        guard let request = WatchAuth.refreshRequest(baseUrl: WatchConfig.supabaseUrl,
                                                     anonKey: WatchConfig.supabaseAnonKey,
                                                     refreshToken: current.refreshToken)
        else { throw WatchAuthError.badRequest }

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        // 400/401 = token odvolán (odhlášení, změna hesla). Síťová chyba NENÍ
        // důvod k odhlášení — jen se to nepovedlo teď.
        if status == 400 || status == 401 {
            clear()
            throw WatchAuthError.signedOut
        }
        guard status == 200,
              let next = WatchAuth.parseRefresh(data, previous: current, now: Date().timeIntervalSince1970)
        else { throw WatchAuthError.refreshFailed }

        accept(next)
        return next.accessToken
    }

    // MARK: - Keychain

    private func readKeychain() -> WatchAuthToken? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(WatchAuthToken.self, from: data)
    }

    private func writeKeychain(_ value: WatchAuthToken) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        deleteKeychain()
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            // Trénink začíná po odemčení hodinek, ale běží i když zhasnou.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(attributes as CFDictionary, nil)
    }

    private func deleteKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum WatchAuthError: Error {
    case signedOut
    case badRequest
    case refreshFailed
}
