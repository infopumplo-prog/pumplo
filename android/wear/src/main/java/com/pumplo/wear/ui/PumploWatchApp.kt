package com.pumplo.wear.ui

import androidx.compose.runtime.Composable
import com.pumplo.wear.WatchAction
import com.pumplo.wear.WatchPhase
import com.pumplo.wear.WatchWorkoutState

// state == null means the phone has published nothing yet (or endState()
// deleted the snapshot) — the watch is a passive controller in v1.
@Composable
fun PumploWatchApp(state: WatchWorkoutState?, onAction: (WatchAction) -> Unit) {
    when {
        state == null -> IdleScreen()
        state.phase == WatchPhase.SUMMARY -> SummaryScreen()
        state.phase == WatchPhase.IDLE -> IdleScreen()
        state.phase == WatchPhase.REST || state.resting -> RestScreen(state = state, onAction = onAction)
        else -> ActiveSetScreen(state = state, onAction = onAction)
    }
}
