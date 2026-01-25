import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA with injectManifest strategy
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to the user to refresh
    if (confirm("Nová verzia aplikácie je dostupná. Aktualizovať?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("[Main] Pumplo je pripravená na offline použitie!");
  },
  onRegisteredSW(swUrl, registration) {
    console.log("[Main] Service worker registered:", swUrl);
    if (registration) {
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour
    }
  },
  onRegisterError(error) {
    console.error("[Main] Service worker registration failed:", error);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
