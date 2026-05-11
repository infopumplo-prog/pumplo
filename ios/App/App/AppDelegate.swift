import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var audioSessionTimer: Timer?

    private func configureAudioSession() {
        do {
            // .playback + .mixWithOthers: beeps play even in silent mode AND don't interrupt Spotify
            try AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {}
    }

    // Re-asserts .mixWithOthers every 2s in case WKWebView overrides the audio session
    private func startAudioSessionWatch() {
        audioSessionTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            let session = AVAudioSession.sharedInstance()
            if !session.categoryOptions.contains(.mixWithOthers) {
                self?.configureAudioSession()
            }
        }

        // Also re-assert when interrupted (e.g. phone call ends)
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let info = notification.userInfo,
                  let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeRaw),
                  type == .ended else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self?.configureAudioSession()
            }
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        configureAudioSession()
        startAudioSessionWatch()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        configureAudioSession()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        audioSessionTimer?.invalidate()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
