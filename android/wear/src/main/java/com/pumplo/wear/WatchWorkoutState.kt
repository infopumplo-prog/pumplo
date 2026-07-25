package com.pumplo.wear

enum class WatchPhase { SET, REST, SUMMARY, IDLE }

// Mirror of WatchWorkoutState in src/lib/watchWorkout.ts (web = source of truth).
data class WatchWorkoutState(
    val phase: WatchPhase,
    val exerciseName: String,
    val slotCategory: String?,
    val setIndex: Int,
    val totalSets: Int,
    val targetWeight: Double?,
    val targetReps: Int,
    val repMin: Int,
    val repMax: Int,
    val rir: Int?,
    val prevWeight: Double?,
    val prevReps: Int?,
    val weightStep: Double,
    val resting: Boolean,
    val restEndsAt: Long?,
    val nextSetLabel: String?,
)

private fun Map<String, Any?>.num(key: String): Number? = this[key] as? Number
private fun Map<String, Any?>.int(key: String, fallback: Int = 0): Int = num(key)?.toInt() ?: fallback
private fun Map<String, Any?>.dbl(key: String): Double? = num(key)?.toDouble()
private fun Map<String, Any?>.str(key: String): String? = (this[key] as? String)?.takeIf { it.isNotEmpty() }

fun watchStateFromMap(map: Map<String, Any?>): WatchWorkoutState = WatchWorkoutState(
    phase = when (map["phase"] as? String) {
        "set" -> WatchPhase.SET
        "rest" -> WatchPhase.REST
        "summary" -> WatchPhase.SUMMARY
        else -> WatchPhase.IDLE
    },
    exerciseName = map.str("exerciseName") ?: "",
    slotCategory = map.str("slotCategory"),
    setIndex = map.int("setIndex"),
    totalSets = map.int("totalSets"),
    targetWeight = map.dbl("targetWeight"),
    targetReps = map.int("targetReps"),
    repMin = map.int("repMin"),
    repMax = map.int("repMax"),
    rir = map.num("rir")?.toInt(),
    prevWeight = map.dbl("prevWeight"),
    prevReps = map.num("prevReps")?.toInt(),
    weightStep = map.dbl("weightStep")?.takeIf { it > 0.0 } ?: 0.5,
    resting = map["resting"] as? Boolean ?: false,
    restEndsAt = map.num("restEndsAt")?.toLong(),
    nextSetLabel = map.str("nextSetLabel"),
)
