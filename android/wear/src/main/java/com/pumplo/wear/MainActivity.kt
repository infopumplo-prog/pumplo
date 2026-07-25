package com.pumplo.wear

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.wear.compose.material.Text
import com.pumplo.wear.ui.PumploCyan
import com.pumplo.wear.ui.PumploNavy

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Gym use: the screen must not sleep mid-set.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContent {
            Box(
                modifier = Modifier.fillMaxSize().background(PumploNavy),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "Pumplo", color = PumploCyan)
            }
        }
    }
}
