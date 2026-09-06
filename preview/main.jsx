/* Preview harness. The prototype was written against the Claude artifact
   runtime's `window.storage`, which exists nowhere else, so this stands one up
   over localStorage with the same shape: get() resolves to {value} or null,
   set() resolves to a truthy result. Nothing else about the app is changed —
   this file exists so the real component tree can be run and looked at. */
import "./inter.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../LipidLog.jsx";
import { seedIfEmpty } from "./sample-readings.js";

window.storage = {
  async get(key) {
    try { const v = localStorage.getItem(key); return v == null ? null : { value: v }; }
    catch { return null; }
  },
  async set(key, value) {
    try { localStorage.setItem(key, value); return { ok: true }; }
    catch { return false; }
  },
};

seedIfEmpty();
createRoot(document.getElementById("root")).render(<App />);
