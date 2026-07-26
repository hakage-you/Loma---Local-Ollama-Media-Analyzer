import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// `npm run dev:mock` (--mode mock) の時だけ有効化する、ドキュメント用スクリーンショット撮影向けの
// 静的サムネイル配信プラグイン。test_assets/mock/ 配下のファイルを /mock-assets/<filename> で返す。
function mockAssetsPlugin(): Plugin {
  const mockDir = path.resolve(__dirname, "test_assets/mock");
  return {
    name: "loma-mock-assets",
    configureServer(server) {
      server.middlewares.use("/mock-assets", (req, res, next) => {
        const fileName = decodeURIComponent((req.url || "").split("?")[0].replace(/^\/+/, ""));
        const filePath = path.join(mockDir, fileName);
        if (!filePath.startsWith(mockDir) || !fs.existsSync(filePath)) {
          next();
          return;
        }
        res.setHeader("Content-Type", "image/jpeg");
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "mock" ? [mockAssetsPlugin()] : [])],

  resolve: {
    alias:
      mode === "mock"
        ? {
            "@tauri-apps/api/core": path.resolve(__dirname, "src/mocks/core.ts"),
            "@tauri-apps/api/event": path.resolve(__dirname, "src/mocks/event.ts"),
            "@tauri-apps/plugin-dialog": path.resolve(__dirname, "src/mocks/pluginDialog.ts"),
            "@tauri-apps/plugin-opener": path.resolve(__dirname, "src/mocks/pluginOpener.ts"),
          }
        : {},
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  // (mock mode is a plain browser dev server, not launched by Tauri, so it doesn't need the fixed port)
  server: {
    port: mode === "mock" ? Number(process.env.PORT) || undefined : 1420,
    strictPort: mode !== "mock",
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
