package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class FormattingTest {

    @Test
    fun formatsWeightWithCzechDecimalComma() {
        assertEquals("40,0", formatWeight(40.0))
        assertEquals("37,5", formatWeight(37.5))
        assertEquals("–", formatWeight(null))
    }

    @Test
    fun stepsWeightByHalfKilo() {
        assertEquals(40.5, stepWeight(40.0, 1, 0.5), 0.001)
        assertEquals(39.5, stepWeight(40.0, -1, 0.5), 0.001)
    }

    @Test
    fun weightNeverGoesNegativeAndNullStartsAtZero() {
        assertEquals(0.0, stepWeight(0.0, -1, 0.5), 0.001)
        assertEquals(0.5, stepWeight(null, 1, 0.5), 0.001)
        assertEquals(0.0, stepWeight(null, -1, 0.5), 0.001)
    }

    @Test
    fun stepsRepsByOneWithFloorOfOne() {
        assertEquals(11, stepReps(10, 1))
        assertEquals(9, stepReps(10, -1))
        assertEquals(1, stepReps(1, -1))
    }

    @Test
    fun mapsSlotCategoriesToCzechLabels() {
        assertEquals("Hlavní", slotLabel("main"))
        assertEquals("Pomocný", slotLabel("secondary"))
        assertEquals("Izolace", slotLabel("isolation"))
        assertEquals("Core", slotLabel("core_or_compensatory"))
        assertEquals("Kardio", slotLabel("conditioning"))
        assertEquals("Cvik", slotLabel(null))
        assertEquals("Cvik", slotLabel("nekonecne_nove_neco"))
    }
}
