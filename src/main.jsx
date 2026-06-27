import React from "react";
import { createRoot } from "react-dom/client";
import SpeedDesk from "./SpeedDesk.jsx";
import "./styles.css";

if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = window.localStorage.getItem(key);
      return value == null ? null : { value };
    },
    async set(key, value) {
      window.localStorage.setItem(key, value);
      return { key, value };
    },
  };
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("sw.js", window.location.href), { scope: "./" }).catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SpeedDesk />
  </React.StrictMode>
);
