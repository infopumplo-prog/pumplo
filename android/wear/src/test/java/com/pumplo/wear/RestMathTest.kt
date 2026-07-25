package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class RestMathTest {

    private val now = 1_753_400_000_000L

    @Test
    fun roundsRemainingUpToWholeSeconds() {
        assertEquals(72, remainingSeconds(now + 71_400, now))
        assertEquals(1, remainingSeconds(now + 10, now))
    }

    @Test
    fun clampsFinishedAndMissingRest() {
        assertEquals(0, remainingSeconds(now - 5_000, now))
        assertEquals(0, remainingSeconds(null, now))
    }

    @Test
    fun formatsClock() {
        assertEquals("1:12", formatClock(72))
        assertEquals("0:09", formatClock(9))
        assertEquals("0:00", formatClock(0))
        assertEquals("2:00", formatClock(120))
    }

    @Test
    fun firstRestSetsTotalFromNow() {
        assertEquals(90_000L, updatedRestTotal(null, now + 90_000, now, 0L))
    }

    @Test
    fun addingFifteenSecondsGrowsTheTotal() {
        val total = updatedRestTotal(null, now + 90_000, now, 0L)
        assertEquals(105_000L, updatedRestTotal(now + 90_000, now + 105_000, now + 30_000, total))
    }

    @Test
    fun totalNeverDropsBelowOne() {
        assertEquals(1L, updatedRestTotal(now + 90_000, now + 10_000, now, 5_000L))
    }
}
