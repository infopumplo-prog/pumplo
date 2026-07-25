package com.pumplo.wear

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Text
import com.pumplo.wear.ui.ActiveSetScreen
import com.pumplo.wear.ui.PumploCyan
import com.pumplo.wear.ui.PumploNavy

class MainActivity : ComponentActivity() {

    private lateinit var repository: WearableRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        repository = WearableRepository(applicationContext)
        setContent {
            val state by repository.state.collectAsState()
            val current = state
            if (current != null && current.phase == WatchPhase.SET) {
                ActiveSetScreen(state = current, onAction = { repository.send(it) })
            } else {
                Box(
                    modifier = Modifier.fillMaxSize().background(PumploNavy).padding(12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = current?.phase?.name ?: "Čekám na telefon…", color = PumploCyan, textAlign = TextAlign.Center)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        repository.start()
    }

    override fun onStop() {
        repository.stop()
        super.onStop()
    }
}
