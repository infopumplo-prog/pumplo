package com.pumplo.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Text
import com.pumplo.wear.WatchAction
import com.pumplo.wear.WatchHaptics
import com.pumplo.wear.WatchWorkoutState
import com.pumplo.wear.formatClock
import com.pumplo.wear.remainingSeconds
import com.pumplo.wear.updatedRestTotal
import kotlinx.coroutines.delay

@Composable
fun RestScreen(state: WatchWorkoutState, onAction: (WatchAction) -> Unit) {
    val context = LocalContext.current
    val haptics = remember { WatchHaptics(context) }

    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    var totalMs by remember { mutableStateOf(1L) }
    var prevEndsAt by remember { mutableStateOf<Long?>(null) }

    LaunchedEffect(state.restEndsAt) {
        val endsAt = state.restEndsAt
        if (endsAt != null) {
            totalMs = updatedRestTotal(prevEndsAt, endsAt, System.currentTimeMillis(), totalMs)
            prevEndsAt = endsAt
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(200L)
        }
    }

    val remaining = remainingSeconds(state.restEndsAt, now)
    LaunchedEffect(remaining) {
        when {
            remaining in 1..3 -> haptics.tick()
            remaining == 0 && state.restEndsAt != null -> haptics.finish()
        }
    }

    val progress = ((state.restEndsAt ?: 0L) - now).toFloat() / totalMs.toFloat()

    Column(
        modifier = Modifier.fillMaxSize().background(PumploNavy).padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(contentAlignment = Alignment.Center) {
            CircularProgressIndicator(
                progress = progress.coerceIn(0f, 1f),
                modifier = Modifier.size(96.dp),
                indicatorColor = PumploCyan,
                trackColor = PumploCard,
                strokeWidth = 6.dp,
            )
            Text(
                text = formatClock(remaining),
                color = PumploWhite,
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Pauza" + (state.nextSetLabel?.let { " · pak $it" } ?: ""),
            color = PumploMuted,
            fontSize = 12.sp,
        )
        Spacer(modifier = Modifier.height(6.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { onAction(WatchAction.AddRest15) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
            ) { Text(text = "+15 s", color = PumploWhite, fontSize = 12.sp) }

            Button(
                onClick = { onAction(WatchAction.SkipRest) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
            ) { Text(text = "Přeskočit", color = PumploWhite, fontSize = 12.sp) }
        }
    }
}
