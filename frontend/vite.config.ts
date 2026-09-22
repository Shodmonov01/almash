import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_API_URL = "http://localhost:3001";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname, "VITE_");
  const apiTarget = (env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const proxy = {
    "/api": { target: apiTarget, changeOrigin: true },
    "/uploads": { target: apiTarget, changeOrigin: true },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(dirname, "src"),
      },
    },
    server: {
      port: 5173,
      proxy,
    },
    preview: {
      proxy,
    },
  };
});
