package com.pumplo.app;

// Constants + pure helpers for the phone -> watch state channel.
// The workout effect on the web re-fires on many dependency changes, so we
// only put a new DataItem when the serialized snapshot actually differs.
public final class WatchStateBridge {

    public static final String STATE_PATH = "/pumplo/workout-state";
    public static final String KEY_JSON = "json";
    public static final String KEY_UPDATED_AT = "updatedAt";

    private WatchStateBridge() { }

    public static boolean shouldSend(String lastPayload, String newPayload) {
        if (newPayload == null || newPayload.isEmpty()) return false;
        return !newPayload.equals(lastPayload);
    }
}
