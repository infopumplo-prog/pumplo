package com.pumplo.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class WatchActionCodecTest {

    @Test
    public void decodesLogSetWithWeight() {
        WatchAction a = WatchActionCodec.decode("logSet|40.5|10");
        assertEquals("logSet", a.type);
        assertEquals(Double.valueOf(40.5), a.weight);
        assertEquals(Integer.valueOf(10), a.reps);
    }

    @Test
    public void decodesLogSetWithoutWeight() {
        WatchAction a = WatchActionCodec.decode("logSet|-|8");
        assertEquals("logSet", a.type);
        assertNull(a.weight);
        assertEquals(Integer.valueOf(8), a.reps);
    }

    @Test
    public void decodesSimpleActions() {
        assertEquals("goPrevSet", WatchActionCodec.decode("goPrevSet").type);
        assertEquals("goNextSet", WatchActionCodec.decode("goNextSet").type);
        assertEquals("skipRest", WatchActionCodec.decode("skipRest").type);
        assertEquals("addRest15", WatchActionCodec.decode("addRest15").type);
    }

    @Test
    public void rejectsGarbage() {
        assertNull(WatchActionCodec.decode(""));
        assertNull(WatchActionCodec.decode(null));
        assertNull(WatchActionCodec.decode("logSet|40.5"));
        assertNull(WatchActionCodec.decode("logSet|x|y"));
        assertNull(WatchActionCodec.decode("selfDestruct"));
    }
}
