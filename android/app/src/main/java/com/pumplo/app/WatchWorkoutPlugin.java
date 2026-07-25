package com.pumplo.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Bridge between the web workout session and a paired Wear OS watch.
// Data Layer wiring lands in the next task; every method must stay no-op safe
// when no watch is paired (same contract as RestActivityPlugin).
@CapacitorPlugin(name = "WatchWorkout")
public class WatchWorkoutPlugin extends Plugin {

    @PluginMethod
    public void updateState(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void endState(PluginCall call) {
        call.resolve();
    }
}
