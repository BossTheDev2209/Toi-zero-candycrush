import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // `ws: true` so the interactive-terminal WebSocket (/api/runs/:id/terminal)
      // is proxied through to the API server alongside the HTTP routes.
      "/api": { target: "http://localhost:8787", ws: true },
    },
  },
});
