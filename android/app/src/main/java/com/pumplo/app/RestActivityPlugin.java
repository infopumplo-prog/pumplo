package com.pumplo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Ongoing rest-timer notification: system-drawn countdown chronometer with the
// current exercise + next set. Silent by design — the audible rest-end alert
// stays with the existing local notification (channel pumplo_rest, id 9911).
@CapacitorPlugin(name = "RestActivity")
public class RestActivityPlugin extends Plugin {

    private static final int NOTIF_ID = 9912;
    private static final String CHANNEL_ID = "pumplo_rest_live";
    private boolean channelEnsured = false;
    // update() often carries only the new endsAt — keep the last texts so the
    // ongoing notification never goes blank on ±15 s adjustments.
    private String lastExerciseName = "";
    private String lastNextSetText = "";

    @PluginMethod
    public void start(PluginCall call) { show(call); }

    @PluginMethod
    public void update(PluginCall call) { show(call); }

    @PluginMethod
    public void end(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(NOTIF_ID);
        call.resolve();
    }

    // Upcoming-set card (no countdown, no lock-screen button on Android yet).
    @PluginMethod
    public void showSet(PluginCall call) {
        Context ctx = getContext();
        NotificationManagerCompat mgr = NotificationManagerCompat.from(ctx);
        if (!mgr.areNotificationsEnabled()) { call.resolve(); return; }
        ensureChannel(ctx);

        String exerciseName = call.getString("exerciseName", "");
        String setText = call.getString("setText", "");
        String detailText = call.getString("detailText", "");

        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent tap = launch == null ? null : PendingIntent.getActivity(
                ctx, 9912, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(exerciseName)
                .setContentText(setText + (detailText.isEmpty() ? "" : " · " + detailText))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        if (tap != null) b.setContentIntent(tap);
        try { mgr.notify(NOTIF_ID, b.build()); } catch (SecurityException ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void consumePending(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("completions", new JSArray());
        call.resolve(ret);
    }

    private void show(PluginCall call) {
        Context ctx = getContext();
        NotificationManagerCompat mgr = NotificationManagerCompat.from(ctx);
        if (!mgr.areNotificationsEnabled()) { call.resolve(); return; }
        ensureChannel(ctx);

        Double endsAt = call.getDouble("endsAt");
        if (endsAt == null) { call.resolve(); return; }
        String exerciseName = call.getString("exerciseName", "");
        String nextSetText = call.getString("nextSetText", "");
        if (exerciseName.isEmpty()) exerciseName = lastExerciseName; else lastExerciseName = exerciseName;
        if (nextSetText.isEmpty()) nextSetText = lastNextSetText; else lastNextSetText = nextSetText;

        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent tap = launch == null ? null : PendingIntent.getActivity(
                ctx, 9912, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(exerciseName)
                .setContentText(nextSetText)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(true)
                .setWhen((long) (double) endsAt)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        if (tap != null) b.setContentIntent(tap);

        try { mgr.notify(NOTIF_ID, b.build()); } catch (SecurityException ignored) { }
        call.resolve();
    }

    private void ensureChannel(Context ctx) {
        if (channelEnsured || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { channelEnsured = true; return; }
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Odpočet pauzy", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Průběžný odpočet pauzy mezi sériemi");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        channelEnsured = true;
    }
}
