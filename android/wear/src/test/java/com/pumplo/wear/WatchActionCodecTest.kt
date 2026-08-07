package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class WatchActionCodecTest {

    // These literals are the wire contract shared with
    // android/app/src/main/java/com/pumplo/app/WatchActionCodec.java — keep in sync.
    @Test
    fun encodesLogSetWithWeight() {
        assertEquals("logSet|40.5|10", encodeWatchAction(WatchAction.LogSet(40.5, 10)))
    }

    @Test
    fun encodesWholeWeightWithOneDecimal() {
        assertEquals("logSet|40.0|10", encodeWatchAction(WatchAction.LogSet(40.0, 10)))
    }

    @Test
    fun encodesLogSetWithoutWeight() {
        assertEquals("logSet|-|8", encodeWatchAction(WatchAction.LogSet(null, 8)))
    }

    @Test
    fun encodesSimpleActions() {
        assertEquals("goPrevSet", encodeWatchAction(WatchAction.GoPrevSet))
        assertEquals("goNextSet", encodeWatchAction(WatchAction.GoNextSet))
        assertEquals("skipRest", encodeWatchAction(WatchAction.SkipRest))
        assertEquals("addRest15", encodeWatchAction(WatchAction.AddRest15))
    }
}
