package com.pumplo.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text

@Composable
fun IdleScreen() {
    Column(
        modifier = Modifier.fillMaxSize().background(PumploNavy).padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "Pumplo", color = PumploCyan, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Čekám na telefon…",
            color = PumploWhite,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Spusť trénink v aplikaci",
            color = PumploMuted,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun SummaryScreen() {
    Column(
        modifier = Modifier.fillMaxSize().background(PumploNavy).padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "Hotovo", color = PumploCyan, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Trénink dokončen",
            color = PumploWhite,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Souhrn najdeš v telefonu",
            color = PumploMuted,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }
}
