import Foundation

// Odpovědi serverové funkce watch-api. Čisté Foundation, aby se dekódování
// dalo testovat harnessem — síť řeší WatchApiClient.

struct WatchApiExercise: Codable, Equatable {
    let exerciseId: String?
    let name: String
    let nameEn: String?
    let slotCategory: String?
    let sets: Int
    let repMin: Int
    let repMax: Int
    let rir: Int?
    let targetWeight: Double?
    let restSeconds: Int
    let isCardio: Bool
    let durationSeconds: Int?
    let thumbUrl: String?
    // Vlastní plán umí hodnoty po jednotlivých sériích.
    let repsPerSet: [Int]?
    let weightPerSet: [Double]?
    let restPerSet: [Int]?

    // Cílová váha pro konkrétní sérii (1-based), s pádem zpět na cvik.
    func targetWeight(forSet setNumber: Int) -> Double? {
        if let weightPerSet, setNumber >= 1, setNumber <= weightPerSet.count {
            return weightPerSet[setNumber - 1]
        }
        return targetWeight
    }

    func reps(forSet setNumber: Int) -> (min: Int, max: Int) {
        if let repsPerSet, setNumber >= 1, setNumber <= repsPerSet.count {
            return (repsPerSet[setNumber - 1], repsPerSet[setNumber - 1])
        }
        return (repMin, repMax)
    }

    func restSeconds(forSet setNumber: Int) -> Int {
        if let restPerSet, setNumber >= 1, setNumber <= restPerSet.count {
            return restPerSet[setNumber - 1]
        }
        return restSeconds
    }
}

struct WatchApiWorkout: Codable, Equatable {
    let title: String
    let kind: String          // "plan" | "custom"
    let planId: String?
    let dayId: String?
    let gymId: String?
    let dayLetter: String?
    let goalId: String?
    let exercises: [WatchApiExercise]
}

struct WatchApiMenuPlan: Codable, Equatable {
    let label: String
    let dayLetter: String
    let exerciseCount: Int
}

struct WatchApiMenuDay: Codable, Equatable {
    let planId: String
    let dayId: String
    let label: String
}

struct WatchApiMenu: Codable, Equatable {
    let plan: WatchApiMenuPlan?
    let customDays: [WatchApiMenuDay]
}

enum WatchApi {
    static func menuRequest(baseUrl: String, anonKey: String, accessToken: String) -> URLRequest? {
        request(url: "\(baseUrl)/menu", anonKey: anonKey, accessToken: accessToken)
    }

    static func planWorkoutRequest(baseUrl: String, anonKey: String, accessToken: String) -> URLRequest? {
        request(url: "\(baseUrl)/workout?kind=plan", anonKey: anonKey, accessToken: accessToken)
    }

    static func customWorkoutRequest(baseUrl: String, anonKey: String, accessToken: String,
                                     planId: String, dayId: String) -> URLRequest? {
        // Identifikátory jsou UUID, ale procházejí do URL — kódujeme je tak jako tak.
        let plan = planId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? planId
        let day = dayId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? dayId
        return request(url: "\(baseUrl)/workout?kind=custom&planId=\(plan)&dayId=\(day)",
                       anonKey: anonKey, accessToken: accessToken)
    }

    private static func request(url: String, anonKey: String, accessToken: String) -> URLRequest? {
        guard let parsed = URL(string: url) else { return nil }
        var request = URLRequest(url: parsed)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        // V posilovně bývá signál mizerný — radši rychle selhat a říct to,
        // než nechat uživatele koukat na kolečko.
        request.timeoutInterval = 15
        return request
    }

    static func decodeMenu(_ data: Data) -> WatchApiMenu? {
        try? JSONDecoder().decode(WatchApiMenu.self, from: data)
    }

    static func decodeWorkout(_ data: Data) -> WatchApiWorkout? {
        try? JSONDecoder().decode(WatchApiWorkout.self, from: data)
    }

    // MARK: - Uložení dokončeného tréninku (POST /complete)

    struct CompletionSet: Codable {
        let weight: Double?
        let reps: Int
        let completed: Bool
    }

    struct CompletionExercise: Codable {
        let exerciseId: String?
        let exerciseName: String
        let sets: [CompletionSet]
    }

    struct CompletionBody: Codable {
        let clientSessionId: String
        let kind: String
        let planId: String?
        let gymId: String?
        let goalId: String?
        let dayLetter: String?
        let startedAt: String
        let completedAt: String
        let exercises: [CompletionExercise]
    }

    // Čistá funkce kvůli harnessu: z enginu poskládá tělo requestu. Posílají
    // se jen zapsané série — na hodinkách nejde zapsat nedokončená.
    static func completionBody(for local: LocalWorkout, completedAt: Date = Date()) -> Data? {
        let iso = ISO8601DateFormatter()
        let exercises = local.workout.exercises.enumerated().compactMap { index, ex -> CompletionExercise? in
            let sets = (local.logged[index] ?? []).map {
                CompletionSet(weight: $0.weight, reps: $0.reps, completed: true)
            }
            guard !sets.isEmpty else { return nil }
            return CompletionExercise(exerciseId: ex.exerciseId, exerciseName: ex.name, sets: sets)
        }
        let body = CompletionBody(
            clientSessionId: local.clientSessionId,
            kind: local.workout.kind,
            planId: local.workout.planId,
            gymId: local.workout.gymId,
            goalId: local.workout.goalId,
            dayLetter: local.workout.dayLetter,
            startedAt: iso.string(from: local.startedAt),
            completedAt: iso.string(from: completedAt),
            exercises: exercises)
        return try? JSONEncoder().encode(body)
    }

    static func completeRequest(baseUrl: String, anonKey: String, accessToken: String,
                                body: Data) -> URLRequest? {
        guard var request = request(url: "\(baseUrl)/complete", anonKey: anonKey, accessToken: accessToken)
        else { return nil }
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        return request
    }
}
