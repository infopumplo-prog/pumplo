package com.pumplo.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WatchStateBridgeTest {

    @Test
    public void sendsFirstPayload() {
        assertTrue(WatchStateBridge.shouldSend(null, "{\"phase\":\"set\"}"));
    }

    @Test
    public void skipsIdenticalPayload() {
        assertFalse(WatchStateBridge.shouldSend("{\"phase\":\"set\"}", "{\"phase\":\"set\"}"));
    }

    @Test
    public void sendsChangedPayload() {
        assertTrue(WatchStateBridge.shouldSend("{\"phase\":\"set\"}", "{\"phase\":\"rest\"}"));
    }

    @Test
    public void skipsEmptyPayload() {
        assertFalse(WatchStateBridge.shouldSend(null, null));
        assertFalse(WatchStateBridge.shouldSend(null, ""));
    }
}
