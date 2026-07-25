package com.pumplo.wear

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.pumplo.wear.ui.PumploWatchApp

class MainActivity : ComponentActivity() {

    private lateinit var repository: WearableRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        repository = WearableRepository(applicationContext)
        setContent {
            val state by repository.state.collectAsState()
            PumploWatchApp(state = state, onAction = { repository.send(it) })
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
