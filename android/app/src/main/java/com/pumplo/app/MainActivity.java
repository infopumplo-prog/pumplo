package com.pumplo.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // App-local plugin: native "Share to Instagram Stories" background handoff.
        // Must be registered before super.onCreate() loads the bridge.
        registerPlugin(InstagramSharePlugin.class);
        super.onCreate(savedInstanceState);
        // Edge-to-edge: app content goes behind status bar and nav bar,
        // so env(safe-area-inset-*) returns correct values in the WebView.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
