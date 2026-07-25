package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WatchWorkoutStateTest {

    private val full = mapOf<String, Any?>(
        "phase" to "set",
        "exerciseName" to "Šikmý tlak na prsa",
        "slotCategory" to "main",
        "setIndex" to 1,
        "totalSets" to 3,
        "targetWeight" to 40.0,
        "targetReps" to 12,
        "repMin" to 8,
        "repMax" to 12,
        "rir" to 2,
        "prevWeight" to 37.5,
        "prevReps" to 10,
        "weightStep" to 0.5,
        "resting" to false,
        "restEndsAt" to null,
        "nextSetLabel" to null,
    )

    @Test
    fun parsesActiveSet() {
        val s = watchStateFromMap(full)
        assertEquals(WatchPhase.SET, s.phase)
        assertEquals("Šikmý tlak na prsa", s.exerciseName)
        assertEquals("main", s.slotCategory)
        assertEquals(1, s.setIndex)
        assertEquals(3, s.totalSets)
        assertEquals(40.0, s.targetWeight!!, 0.001)
        assertEquals(12, s.targetReps)
        assertEquals(8, s.repMin)
        assertEquals(2, s.rir)
        assertEquals(37.5, s.prevWeight!!, 0.001)
        assertEquals(10, s.prevReps)
        assertEquals(0.5, s.weightStep, 0.001)
    }

    @Test
    fun parsesRestWithEndsAt() {
        val s = watchStateFromMap(full + mapOf(
            "phase" to "rest", "resting" to true,
            "restEndsAt" to 1_753_400_000_000L, "nextSetLabel" to "3. série",
        ))
        assertEquals(WatchPhase.REST, s.phase)
        assertEquals(true, s.resting)
        assertEquals(1_753_400_000_000L, s.restEndsAt)
        assertEquals("3. série", s.nextSetLabel)
    }

    @Test
    fun keepsNullsForMissingWeights() {
        val s = watchStateFromMap(full + mapOf("targetWeight" to null, "prevWeight" to null, "prevReps" to null, "rir" to null))
        assertNull(s.targetWeight)
        assertNull(s.prevWeight)
        assertNull(s.prevReps)
        assertNull(s.rir)
    }

    @Test
    fun toleratesNumbersArrivingAsOtherTypes() {
        // JSON may hand us Int where we expect Double and vice versa.
        val s = watchStateFromMap(full + mapOf("targetWeight" to 40, "restEndsAt" to 1_753_400_000_000.0, "setIndex" to 2.0))
        assertEquals(40.0, s.targetWeight!!, 0.001)
        assertEquals(1_753_400_000_000L, s.restEndsAt)
        assertEquals(2, s.setIndex)
    }

    @Test
    fun fallsBackToIdleOnUnknownPhaseAndMissingKeys() {
        val s = watchStateFromMap(mapOf("phase" to "between"))
        assertEquals(WatchPhase.IDLE, s.phase)
        assertEquals("", s.exerciseName)
        assertEquals(0, s.setIndex)
        assertEquals(0.5, s.weightStep, 0.001)
    }
}
