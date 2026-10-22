import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// changeOrigin must be false (the string shorthand turns it on), so Django sees the browser's
// Host: the CSRF origin check and patient links then use the Vite origin, like production.
const backend = { target: "http://localhost:8000", changeOrigin: false };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Quick tunnels for phone testing (microphone needs HTTPS). Django must allow them too.
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app"],
    proxy: {
      "/api": backend,
      "/admin": backend,
      "/static": backend,
    },
  },
});
