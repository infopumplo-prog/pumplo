import Foundation
import Capacitor
import UIKit

// Shares a finished-workout card directly as an Instagram Story BACKGROUND.
// The generic share sheet hands IG a file, which IG drops onto the live camera
// as a sticker (you see the selfie behind the card). Instead we use IG's
// documented Stories handoff: put the PNG on the pasteboard under the
// `com.instagram.sharedSticker.backgroundImage` key and open the
// `instagram-stories://share` URL, which makes the image the full background.
// Requires `instagram-stories` in LSApplicationQueriesSchemes (Info.plist).
@objc(InstagramSharePlugin)
public class InstagramSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InstagramSharePlugin"
    public let jsName = "InstagramShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isInstalled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareToStories", returnType: CAPPluginReturnPromise)
    ]

    private static let storiesScheme = "instagram-stories://share?source_application=com.pumplo.app"

    @objc func isInstalled(_ call: CAPPluginCall) {
        guard let url = URL(string: InstagramSharePlugin.storiesScheme) else {
            call.resolve(["installed": false]); return
        }
        DispatchQueue.main.async {
            call.resolve(["installed": UIApplication.shared.canOpenURL(url)])
        }
    }

    @objc func shareToStories(_ call: CAPPluginCall) {
        guard let path = call.getString("imagePath") else {
            call.reject("missing imagePath"); return
        }
        // Filesystem returns a file:// URI; fall back to a bare path if needed.
        let fileURL = URL(string: path) ?? URL(fileURLWithPath: path)
        guard let data = try? Data(contentsOf: fileURL) else {
            call.reject("could not read image at \(path)"); return
        }
        guard let storiesURL = URL(string: InstagramSharePlugin.storiesScheme) else {
            call.reject("bad instagram url"); return
        }

        DispatchQueue.main.async {
            guard UIApplication.shared.canOpenURL(storiesURL) else {
                call.reject("instagram not installed"); return
            }
            let items: [[String: Any]] = [["com.instagram.sharedSticker.backgroundImage": data]]
            let options: [UIPasteboard.OptionsKey: Any] = [
                .expirationDate: Date().addingTimeInterval(60 * 5)
            ]
            UIPasteboard.general.setItems(items, options: options)
            UIApplication.shared.open(storiesURL, options: [:]) { success in
                if success { call.resolve() } else { call.reject("failed to open instagram") }
            }
        }
    }
}
