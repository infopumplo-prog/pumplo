package com.pumplo.wear

import android.content.Context
import android.net.Uri
import android.util.Log
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

private const val TAG = "PumploWear"

// Single source of truth on the watch: the newest snapshot the phone put into
// the Data Layer. Actions travel back as MessageClient messages.
class WearableRepository(private val context: Context) : com.google.android.gms.wearable.DataClient.OnDataChangedListener {

    private val _state = MutableStateFlow<WatchWorkoutState?>(null)
    val state: StateFlow<WatchWorkoutState?> = _state.asStateFlow()

    private var lastUpdatedAt = Long.MIN_VALUE

    private val stateUri: Uri = Uri.Builder()
        .scheme(PutDataRequest.WEAR_URI_SCHEME)
        .authority("*")
        .path(STATE_PATH)
        .build()

    fun start() {
        try {
            Wearable.getDataClient(context).addListener(this)
            refresh()
        } catch (t: Throwable) {
            Log.d(TAG, "data client unavailable: $t")
        }
    }

    fun stop() {
        try {
            Wearable.getDataClient(context).removeListener(this)
        } catch (t: Throwable) {
            Log.d(TAG, "removeListener failed: $t")
        }
    }

    // Phone may have published the snapshot before this app was opened.
    private fun refresh() {
        Wearable.getDataClient(context).getDataItems(stateUri)
            .addOnSuccessListener { buffer ->
                var newest: DataMap? = null
                var newestAt = Long.MIN_VALUE
                for (item in buffer) {
                    val map = DataMapItem.fromDataItem(item).dataMap
                    val at = map.getLong(KEY_UPDATED_AT)
                    if (at >= newestAt) {
                        newestAt = at
                        newest = map
                    }
                }
                buffer.release()
                newest?.let { apply(it) }
            }
            .addOnFailureListener { Log.d(TAG, "getDataItems failed: $it") }
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.dataItem.uri.path != STATE_PATH) continue
            when (event.type) {
                DataEvent.TYPE_CHANGED -> apply(DataMapItem.fromDataItem(event.dataItem).dataMap)
                DataEvent.TYPE_DELETED -> {
                    lastUpdatedAt = Long.MIN_VALUE
                    _state.value = null
                    Log.d(TAG, "state cleared by phone")
                }
            }
        }
        events.release()
    }

    private fun apply(map: DataMap) {
        val updatedAt = map.getLong(KEY_UPDATED_AT)
        if (updatedAt < lastUpdatedAt) return  // stale snapshot, newest wins
        lastUpdatedAt = updatedAt
        val json = map.getString(KEY_JSON) ?: return
        val parsed = try {
            watchStateFromMap(jsonToMap(json))
        } catch (t: Throwable) {
            Log.d(TAG, "bad snapshot: $t")
            return
        }
        Log.d(TAG, "state: phase=${parsed.phase} set=${parsed.setIndex + 1}/${parsed.totalSets}")
        _state.value = parsed
    }

    fun send(action: WatchAction) {
        val payload = encodeWatchAction(action).toByteArray(Charsets.UTF_8)
        Wearable.getNodeClient(context).connectedNodes
            .addOnSuccessListener { nodes ->
                if (nodes.isEmpty()) Log.d(TAG, "no connected phone node")
                for (node in nodes) {
                    Wearable.getMessageClient(context).sendMessage(node.id, ACTION_PATH, payload)
                        .addOnFailureListener { Log.d(TAG, "sendMessage failed: $it") }
                }
            }
            .addOnFailureListener { Log.d(TAG, "connectedNodes failed: $it") }
    }
}

// Thin adapter: org.json is only available on-device, so all tested logic
// works on a plain Map instead.
private fun jsonToMap(json: String): Map<String, Any?> {
    val obj = JSONObject(json)
    val out = HashMap<String, Any?>()
    for (key in obj.keys()) {
        val value = obj.get(key)
        out[key] = if (value == JSONObject.NULL) null else value
    }
    return out
}
