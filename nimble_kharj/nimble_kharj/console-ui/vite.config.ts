import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Support both standalone deployment (Vercel, Netlify, Cloudflare) and Frappe bench app
export default defineConfig(({ mode }) => {
  const isFrappe = mode === "frappe";
  return {
    plugins: [react()],
    base: isFrappe ? "/assets/nimble_kharj/console/" : "/",
    build: {
      outDir: isFrappe ? "../nimble_kharj/nimble_kharj/public/console" : "dist",
      emptyOutDir: true,
      ...(isFrappe
        ? { rollupOptions: { output: { entryFileNames: "index.js", assetFileNames: "index.[ext]" } } }
        : {}),
    },
    server: {
      port: 5273,
      proxy: {
        "/api": { target: "http://127.0.0.1:8001", changeOrigin: true },
        "/socket.io": { target: "http://127.0.0.1:9000", ws: true },
      },
    },
  };
});
