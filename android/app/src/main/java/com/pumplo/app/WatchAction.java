package com.pumplo.app;

/** One control action sent from the watch. weight/reps are null unless type is logSet. */
public final class WatchAction {
    public final String type;
    public final Double weight;
    public final Integer reps;

    public WatchAction(String type, Double weight, Integer reps) {
        this.type = type;
        this.weight = weight;
        this.reps = reps;
    }
}
