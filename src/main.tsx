import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // Optional: Show a prompt to the user to refresh
    if (confirm("Nová verzia aplikácie je dostupná. Aktualizovať?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("Pumplo je pripravená na offline použitie!");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
