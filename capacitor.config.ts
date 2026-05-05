import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pumplo.app',
  appName: 'Pumplo',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '556331013170-hlaq2ucokm66ubki1c7ap9ncd858pqra.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
};

export default config;
