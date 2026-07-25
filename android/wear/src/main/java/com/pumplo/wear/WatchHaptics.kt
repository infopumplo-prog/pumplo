package com.pumplo.wear

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

// Countdown feedback: a short tick at 3/2/1 and a firmer double buzz at zero.
class WatchHaptics(context: Context) {

    private val vibrator: Vibrator? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(VibratorManager::class.java)
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
    } catch (t: Throwable) {
        null
    }

    fun tick() = play(VibrationEffect.createOneShot(30L, 90))

    fun finish() = play(VibrationEffect.createWaveform(longArrayOf(0L, 140L, 90L, 220L), -1))

    private fun play(effect: VibrationEffect) {
        try {
            vibrator?.takeIf { it.hasVibrator() }?.vibrate(effect)
        } catch (t: Throwable) {
            // No vibrator (emulator without haptics) — silently ignore.
        }
    }
}
