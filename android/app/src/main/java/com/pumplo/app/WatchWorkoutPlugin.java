package com.pumplo.app;

import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.wearable.MessageClient;
import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

// Wear OS bridge for the running workout.
// State goes out as a DataItem (newest snapshot wins); actions come back as
// MessageClient messages and are re-emitted to JS as the "watchAction" event.
// Everything is best-effort: with no watch paired (or no Play services) the
// calls simply do nothing, exactly like RestActivityPlugin.
@CapacitorPlugin(name = "WatchWorkout")
public class WatchWorkoutPlugin extends Plugin {

    private static final String TAG = "PumploWatch";

    private MessageClient messageClient;
    private MessageClient.OnMessageReceivedListener messageListener;
    private String lastPayload = null;

    @Override
    public void load() {
        try {
            messageClient = Wearable.getMessageClient(getContext());
            messageListener = new MessageClient.OnMessageReceivedListener() {
                @Override
                public void onMessageReceived(MessageEvent event) {
                    handleWatchMessage(event);
                }
            };
            messageClient.addListener(messageListener);
        } catch (Throwable t) {
            Log.d(TAG, "Wearable message client unavailable: " + t);
            messageClient = null;
            messageListener = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (messageClient != null && messageListener != null) {
            try {
                messageClient.removeListener(messageListener);
            } catch (Throwable ignored) { }
        }
    }

    @PluginMethod
    public void updateState(PluginCall call) {
        try {
            JSObject data = call.getData();
            data.remove("callbackId");
            String payload = data.toString();
            if (WatchStateBridge.shouldSend(lastPayload, payload)) {
                lastPayload = payload;
                boolean resting = Boolean.TRUE.equals(call.getBoolean("resting", Boolean.FALSE));
                PutDataMapRequest req = PutDataMapRequest.create(WatchStateBridge.STATE_PATH);
                req.getDataMap().putString(WatchStateBridge.KEY_JSON, payload);
                req.getDataMap().putLong(WatchStateBridge.KEY_UPDATED_AT, System.currentTimeMillis());
                PutDataRequest put = req.asPutDataRequest();
                if (resting) put.setUrgent();
                Wearable.getDataClient(getContext()).putDataItem(put);
                Log.d(TAG, "state sent, urgent=" + resting);
            }
        } catch (Throwable t) {
            Log.d(TAG, "updateState skipped: " + t);
        }
        call.resolve();
    }

    @PluginMethod
    public void endState(PluginCall call) {
        lastPayload = null;
        try {
            Uri uri = new Uri.Builder()
                    .scheme(PutDataRequest.WEAR_URI_SCHEME)
                    .authority("*")
                    .path(WatchStateBridge.STATE_PATH)
                    .build();
            Wearable.getDataClient(getContext()).deleteDataItems(uri);
            Log.d(TAG, "state cleared");
        } catch (Throwable t) {
            Log.d(TAG, "endState skipped: " + t);
        }
        call.resolve();
    }

    private void handleWatchMessage(MessageEvent event) {
        if (!WatchActionCodec.ACTION_PATH.equals(event.getPath())) return;
        String payload = new String(event.getData(), StandardCharsets.UTF_8);
        WatchAction action = WatchActionCodec.decode(payload);
        if (action == null) {
            Log.d(TAG, "ignored watch payload: " + payload);
            return;
        }
        JSObject js = new JSObject();
        js.put("type", action.type);
        if (action.weight == null) {
            js.put("weight", JSONObject.NULL);
        } else {
            js.put("weight", action.weight.doubleValue());
        }
        if (action.reps != null) js.put("reps", action.reps.intValue());
        Log.d(TAG, "watchAction -> JS: " + payload);
        notifyListeners("watchAction", js);
    }
}
