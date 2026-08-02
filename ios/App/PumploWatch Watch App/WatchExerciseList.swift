import Foundation

// Zrcadlo WatchExerciseItem z src/lib/watchWorkout.ts. Stejně jako nabídka jede
// seznam JSONem v jednom textovém poli, protože kontrakt propouští jen ploché
// hodnoty.
struct WatchExerciseItem: Codable, Equatable, Identifiable {
    let name: String
    let setsDone: Int
    let setsTotal: Int
    let thumbUrl: String?

    // Index v seznamu je zároveň to, co se posílá zpět v goToExercise, takže
    // identita musí být stabilní i u dvou stejně pojmenovaných cviků.
    var id: String { "\(name)#\(setsTotal)" }

    var isDone: Bool { setsTotal > 0 && setsDone >= setsTotal }
    var progressLabel: String { "\(setsDone) z \(setsTotal) sérií" }
}

enum WatchExerciseList {
    static func decode(_ json: String) -> [WatchExerciseItem] {
        guard let data = json.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([WatchExerciseItem].self, from: data)) ?? []
    }
}
