import Foundation

// Přihlášení hodinek. Čisté Foundation (žádný Keychain ani URLSession), aby se
// rozhodovací logika dala testovat harnessem v ios/App/NativeTests — ukládání
// a síť řeší WatchAuthStore.
//
// Hodinky si relaci NEVYRÁBĚJÍ. Telefon ji jednorázově předá přes
// transferUserInfo a od té chvíle si ji hodinky obnovují samy proti Supabase.

struct WatchAuthToken: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Double // sekundy od 1970, jak je posílá Supabase
    let userId: String

    // Zpráva z telefonu. Propouští jen úplný tvar — půlka relace je horší než
    // žádná, protože by hodinky tvářily jako přihlášené a padaly na 401.
    static func decode(userInfo: [String: Any]) -> WatchAuthToken? {
        guard userInfo["type"] as? String == "auth",
              let accessToken = userInfo["accessToken"] as? String, !accessToken.isEmpty,
              let refreshToken = userInfo["refreshToken"] as? String, !refreshToken.isEmpty,
              let userId = userInfo["userId"] as? String, !userId.isEmpty,
              let expiresAt = (userInfo["expiresAt"] as? NSNumber)?.doubleValue
        else { return nil }
        return WatchAuthToken(accessToken: accessToken, refreshToken: refreshToken,
                              expiresAt: expiresAt, userId: userId)
    }

    static func isClearMessage(userInfo: [String: Any]) -> Bool {
        userInfo["type"] as? String == "authCleared"
    }
}

enum WatchAuth {
    // Obnovujeme s rezervou — token, kterému zbývá půl minuty, by vypršel
    // uprostřed volání.
    static let refreshMarginSeconds: Double = 300

    static func needsRefresh(expiresAt: Double, now: Double) -> Bool {
        expiresAt - now <= refreshMarginSeconds
    }

    // POST {url}/auth/v1/token?grant_type=refresh_token
    static func refreshRequest(baseUrl: String, anonKey: String, refreshToken: String) -> URLRequest? {
        guard let url = URL(string: "\(baseUrl)/auth/v1/token?grant_type=refresh_token") else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        return request
    }

    // Odpověď Supabase na obnovu. Vrací nový token; když chybí refresh_token
    // (Supabase ho při rotaci nemusí poslat), ponechá se ten stávající.
    static func parseRefresh(_ data: Data, previous: WatchAuthToken, now: Double) -> WatchAuthToken? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String, !accessToken.isEmpty
        else { return nil }
        let refreshToken = (json["refresh_token"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? previous.refreshToken
        // expires_at je spolehlivější, expires_in je jen doplněk.
        let expiresAt = (json["expires_at"] as? NSNumber)?.doubleValue
            ?? now + ((json["expires_in"] as? NSNumber)?.doubleValue ?? 3600)
        let userId = ((json["user"] as? [String: Any])?["id"] as? String) ?? previous.userId
        return WatchAuthToken(accessToken: accessToken, refreshToken: refreshToken,
                              expiresAt: expiresAt, userId: userId)
    }
}
