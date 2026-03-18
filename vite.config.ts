import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true, // listen on all interfaces (0.0.0.0) so you can use your machine's IP, e.g. http://10.15.12.115:8080
    port: 8080,
    strictPort: false, // use next port if 8080 is taken
    hmr: {
      overlay: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
