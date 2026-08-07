import Foundation

// Adresa a veřejný klíč Supabase. Stejné hodnoty ship uje i webová appka —
// publishable key je veřejný, tajemstvím je až přihlášení uživatele.
enum WatchConfig {
    static let supabaseUrl = "https://auth.pumplo.com"
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXdqcWdkc2pvYmR1ZmR4YnBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY3NTQsImV4cCI6MjA4Nzk2Mjc1NH0.Ehf4grKfU7flrTbuOXKnH_WRiXVDIp9BjfYif9E4SrY"

    static var watchApiUrl: String { "\(supabaseUrl)/functions/v1/watch-api" }
}
