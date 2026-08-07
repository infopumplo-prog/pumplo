package com.pumplo.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.focusable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Text
import com.pumplo.wear.WatchAction
import com.pumplo.wear.WatchWorkoutState
import com.pumplo.wear.formatWeight
import com.pumplo.wear.slotLabel
import com.pumplo.wear.stepReps
import com.pumplo.wear.stepWeight

private enum class SpinnerField { WEIGHT, REPS }

private const val DRAG_PIXELS_PER_STEP = 24f

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun ActiveSetScreen(state: WatchWorkoutState, onAction: (WatchAction) -> Unit) {
    // Prefill from the target, fall back to what was lifted last time.
    // Re-prefills whenever the phone moves us to a different set.
    val setKey = "${state.exerciseName}#${state.setIndex}"
    var weight by remember(setKey) { mutableStateOf(state.targetWeight ?: state.prevWeight) }
    var reps by remember(setKey) { mutableStateOf(if (state.targetReps > 0) state.targetReps else state.prevReps ?: 10) }
    var field by remember(setKey) { mutableStateOf(SpinnerField.WEIGHT) }

    fun bump(direction: Int) {
        when (field) {
            SpinnerField.WEIGHT -> weight = stepWeight(weight, direction, state.weightStep)
            SpinnerField.REPS -> reps = stepReps(reps, direction)
        }
    }

    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(setKey) { focusRequester.requestFocus() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PumploNavy)
            .padding(horizontal = 10.dp, vertical = 6.dp)
            .onRotaryScrollEvent { event ->
                bump(if (event.verticalScrollPixels > 0) 1 else -1)
                true
            }
            .focusRequester(focusRequester)
            .focusable(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = state.exerciseName,
            color = PumploWhite,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
        Text(
            text = "${slotLabel(state.slotCategory)} · série ${state.setIndex + 1} z ${state.totalSets}",
            color = PumploCyan,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(6.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SpinnerBox(
                label = "KG",
                value = formatWeight(weight),
                active = field == SpinnerField.WEIGHT,
                onSelect = { field = SpinnerField.WEIGHT },
                onDrag = { direction ->
                    field = SpinnerField.WEIGHT
                    weight = stepWeight(weight, direction, state.weightStep)
                },
            )
            SpinnerBox(
                label = "OPAK.",
                value = reps.toString(),
                active = field == SpinnerField.REPS,
                onSelect = { field = SpinnerField.REPS },
                onDrag = { direction ->
                    field = SpinnerField.REPS
                    reps = stepReps(reps, direction)
                },
            )
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Cíl ${state.repMin}–${state.repMax}" + (state.rir?.let { " · RIR $it" } ?: ""),
            color = PumploCyan,
            fontSize = 11.sp,
        )
        if (state.prevWeight != null || state.prevReps != null) {
            Text(
                text = "Naposledy: ${formatWeight(state.prevWeight)} kg × ${state.prevReps ?: "–"}",
                color = PumploMuted,
                fontSize = 10.sp,
            )
        }

        Spacer(modifier = Modifier.height(6.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(
                onClick = { onAction(WatchAction.GoPrevSet) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
                modifier = Modifier.size(36.dp),
            ) { Text(text = "‹", color = PumploWhite, fontSize = 16.sp) }

            Button(
                onClick = { onAction(WatchAction.LogSet(weight, reps)) },
                colors = ButtonDefaults.primaryButtonColors(backgroundColor = PumploCyan),
                modifier = Modifier.size(48.dp),
            ) { Text(text = "✓", color = PumploNavy, fontSize = 20.sp, fontWeight = FontWeight.Bold) }

            Button(
                onClick = { onAction(WatchAction.GoNextSet) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
                modifier = Modifier.size(36.dp),
            ) { Text(text = "›", color = PumploWhite, fontSize = 16.sp) }
        }
    }
}

// Rotary drives the active field; a vertical drag does the same thing so the
// value can also be changed with a mouse on the Wear OS emulator.
@Composable
private fun SpinnerBox(
    label: String,
    value: String,
    active: Boolean,
    onSelect: () -> Unit,
    onDrag: (Int) -> Unit,
) {
    Column(
        modifier = Modifier
            .width(74.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(PumploCard)
            .border(
                width = if (active) 2.dp else 0.dp,
                color = if (active) PumploCyan else PumploCard,
                shape = RoundedCornerShape(12.dp),
            )
            .clickable { onSelect() }
            .pointerInput(label) {
                var accumulated = 0f
                detectVerticalDragGestures(
                    onDragEnd = { accumulated = 0f },
                ) { _, dragAmount ->
                    accumulated -= dragAmount
                    while (accumulated >= DRAG_PIXELS_PER_STEP) {
                        accumulated -= DRAG_PIXELS_PER_STEP
                        onDrag(1)
                    }
                    while (accumulated <= -DRAG_PIXELS_PER_STEP) {
                        accumulated += DRAG_PIXELS_PER_STEP
                        onDrag(-1)
                    }
                }
            }
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = label, color = PumploMuted, fontSize = 10.sp)
        Text(text = value, color = PumploWhite, fontSize = 24.sp, fontWeight = FontWeight.Bold)
    }
}
