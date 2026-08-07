package com.pumplo.wear

import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max

// The watch counts down locally from restEndsAt, so a short connection drop
// does not freeze the timer.
fun remainingSeconds(restEndsAt: Long?, now: Long): Int {
    if (restEndsAt == null) return 0
    val ms = restEndsAt - now
    if (ms <= 0L) return 0
    return ceil(ms / 1000.0).toInt()
}

fun formatClock(totalSeconds: Int): String {
    val safe = max(0, totalSeconds)
    return String.format(Locale.US, "%d:%02d", safe / 60, safe % 60)
}

// Ring length: measured on rest entry, then grown by every +15 s the phone
// confirms, so the arc keeps its meaning instead of snapping back to full.
fun updatedRestTotal(prevEndsAt: Long?, newEndsAt: Long, now: Long, currentTotal: Long): Long {
    val next = if (prevEndsAt == null) newEndsAt - now else currentTotal + (newEndsAt - prevEndsAt)
    return max(1L, next)
}
