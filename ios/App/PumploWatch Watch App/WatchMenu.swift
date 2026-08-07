import Foundation

// Zrcadlo WatchMenu z src/lib/watchWorkout.ts. Jede JSONem v jednom textovém
// poli, protože kontrakt jinak propouští jen ploché hodnoty.
struct WatchMenuItem: Codable, Equatable, Identifiable {
    let kind: String
    let label: String
    let planId: String?
    let dayId: String?

    // Stabilní identita pro seznam — kind sám o sobě nestačí, dnů je víc.
    var id: String { "\(kind)#\(planId ?? "")#\(dayId ?? "")" }
}

struct WatchMenu: Codable, Equatable {
    let items: [WatchMenuItem]
    let truncated: Bool

    static let empty = WatchMenu(items: [], truncated: false)

    static func decode(_ json: String) -> WatchMenu? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WatchMenu.self, from: data)
    }
}
