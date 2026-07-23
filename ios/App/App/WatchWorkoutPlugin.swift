import Capacitor

@objc(WatchWorkoutPlugin)
public class WatchWorkoutPlugin: CAPPlugin {
  @objc func updateState(_ call: CAPPluginCall) {
    call.resolve()
  }

  @objc func endState(_ call: CAPPluginCall) {
    call.resolve()
  }
}
