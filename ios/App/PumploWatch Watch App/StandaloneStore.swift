import Foundation

// Disk hodinek pro samostatný režim: rozdělaný trénink a fronta neodeslaných
// dokončení. Zabití appky uprostřed tréninku nesmí znamenat ztrátu sérií a
// mizerný signál v posilovně nesmí znamenat ztrátu celého tréninku.
//
// Soubory žijí v Application Support; tokeny sem NEpatří (ty drží Keychain
// ve WatchAuthStore).
struct StandaloneStore {
    private let directory: URL
    private var activeUrl: URL { directory.appendingPathComponent("active-workout.json") }
    private var queueUrl: URL { directory.appendingPathComponent("upload-queue.json") }

    init(directory: URL? = nil) {
        if let directory {
            self.directory = directory
        } else {
            let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
                ?? FileManager.default.temporaryDirectory
            self.directory = base.appendingPathComponent("standalone", isDirectory: true)
        }
        try? FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
    }

    // MARK: - Rozdělaný trénink

    func saveActive(_ workout: LocalWorkout) {
        guard let data = try? JSONEncoder().encode(workout) else { return }
        try? data.write(to: activeUrl, options: .atomic)
    }

    func loadActive() -> LocalWorkout? {
        guard let data = try? Data(contentsOf: activeUrl) else { return nil }
        return try? JSONDecoder().decode(LocalWorkout.self, from: data)
    }

    func clearActive() {
        try? FileManager.default.removeItem(at: activeUrl)
    }

    // MARK: - Fronta dokončených tréninků čekajících na signál

    // Fronta drží hotová těla požadavku na /complete. Idempotenci zajišťuje
    // clientSessionId uvnitř — opakované odeslání trénink nezdvojí.
    func loadQueue() -> [Data] {
        guard let data = try? Data(contentsOf: queueUrl),
              let strings = try? JSONDecoder().decode([String].self, from: data) else { return [] }
        return strings.compactMap { Data(base64Encoded: $0) }
    }

    func saveQueue(_ bodies: [Data]) {
        if bodies.isEmpty {
            try? FileManager.default.removeItem(at: queueUrl)
            return
        }
        let strings = bodies.map { $0.base64EncodedString() }
        guard let data = try? JSONEncoder().encode(strings) else { return }
        try? data.write(to: queueUrl, options: .atomic)
    }

    func enqueue(_ body: Data) {
        var queue = loadQueue()
        queue.append(body)
        saveQueue(queue)
    }
}
