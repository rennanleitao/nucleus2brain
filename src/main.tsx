import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Remove any legacy app service worker: it could intercept/cache requests and
// break login ("Failed to fetch") in the installed PWA and in preview.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => {
      const url =
        r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
      if (!url || url.includes("/sw.js") || url.includes("/service-worker.js")) {
        r.unregister();
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
