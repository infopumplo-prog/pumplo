import UIKit
import Capacitor

// Custom Capacitor bridge VC so we can explicitly register the app-local
// RestAudio plugin. App-target plugins are NOT auto-discovered in the SPM
// setup, so we register the instance once the bridge has loaded.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RestAudioPlugin())
    }
}
