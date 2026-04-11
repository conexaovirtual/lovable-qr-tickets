import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      console.log("Service Worker registrado com sucesso:", swUrl, registration?.scope);
    },
    onRegisterError(error) {
      console.error("Erro ao registrar Service Worker:", error);
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
