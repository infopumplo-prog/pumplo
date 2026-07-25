package com.pumplo.wear

import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

// Czech decimal comma; "–" when there is no weight (bodyweight / first time).
fun formatWeight(value: Double?): String =
    value?.let { String.format(Locale.US, "%.1f", it).replace('.', ',') } ?: "–"

fun stepWeight(current: Double?, direction: Int, step: Double): Double {
    val base = current ?: 0.0
    val next = base + direction * step
    // Snap to the step grid so rotary noise cannot drift the value.
    val snapped = (next / step).roundToInt() * step
    return max(0.0, snapped)
}

fun stepReps(current: Int, direction: Int): Int = max(1, current + direction)

// Slot labels mirror src/i18n/locales/cs.ts ('slot.*').
fun slotLabel(raw: String?): String = when (raw) {
    "main" -> "Hlavní"
    "secondary" -> "Pomocný"
    "isolation" -> "Izolace"
    "core_or_compensatory" -> "Core"
    "conditioning" -> "Kardio"
    else -> "Cvik"
}
