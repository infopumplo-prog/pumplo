package com.pumplo.wear

import java.util.Locale

const val ACTION_PATH = "/pumplo/action"
const val STATE_PATH = "/pumplo/workout-state"
const val KEY_JSON = "json"
const val KEY_UPDATED_AT = "updatedAt"

sealed class WatchAction {
    data class LogSet(val weight: Double?, val reps: Int) : WatchAction()
    object GoPrevSet : WatchAction()
    object GoNextSet : WatchAction()
    object SkipRest : WatchAction()
    object AddRest15 : WatchAction()
}

// Wire format decoded by WatchActionCodec.java on the phone.
fun encodeWatchAction(action: WatchAction): String = when (action) {
    is WatchAction.LogSet -> {
        val w = action.weight?.let { String.format(Locale.US, "%.1f", it) } ?: "-"
        "logSet|$w|${action.reps}"
    }
    WatchAction.GoPrevSet -> "goPrevSet"
    WatchAction.GoNextSet -> "goNextSet"
    WatchAction.SkipRest -> "skipRest"
    WatchAction.AddRest15 -> "addRest15"
}
