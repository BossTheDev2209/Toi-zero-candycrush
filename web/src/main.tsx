import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";
import { applyTheme, getTheme } from "./lib/theme";

applyTheme(getTheme());

// NOTE: React.StrictMode intentionally double-invokes mount/cleanup in dev.
// wterm (the terminal emulator) ships React-19 callback refs whose cleanup
// return value React 18 ignores, so the double-mount leaks a dead terminal
// instance and the grid renders blank. Dropping StrictMode keeps the terminal
// working under React 18. (Production never double-invokes regardless.)
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
