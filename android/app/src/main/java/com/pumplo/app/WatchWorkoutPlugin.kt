package com.pumplo.app

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WatchWorkout")
class WatchWorkoutPlugin : Plugin() {
  @PluginMethod
  fun updateState(call: PluginCall) {
    call.resolve()
  }

  @PluginMethod
  fun endState(call: PluginCall) {
    call.resolve()
  }
}
