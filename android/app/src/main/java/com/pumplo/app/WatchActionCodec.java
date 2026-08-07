package com.pumplo.app;

// Wire format (watch -> phone, MessageClient payload, UTF-8):
//   logSet|<weight or ->|<reps>   e.g. "logSet|40.5|10", "logSet|-|8"
//   goPrevSet | goNextSet | skipRest | addRest15
public final class WatchActionCodec {

    public static final String ACTION_PATH = "/pumplo/action";

    private WatchActionCodec() { }

    public static WatchAction decode(String payload) {
        if (payload == null) return null;
        String raw = payload.trim();
        if (raw.isEmpty()) return null;

        if (raw.equals("goPrevSet") || raw.equals("goNextSet")
                || raw.equals("skipRest") || raw.equals("addRest15")) {
            return new WatchAction(raw, null, null);
        }

        String[] parts = raw.split("\\|", -1);
        if (parts.length != 3 || !parts[0].equals("logSet")) return null;
        Double weight = null;
        if (!parts[1].equals("-")) {
            try {
                weight = Double.valueOf(Double.parseDouble(parts[1]));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        try {
            return new WatchAction("logSet", weight, Integer.valueOf(Integer.parseInt(parts[2])));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
