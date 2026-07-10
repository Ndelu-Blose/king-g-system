import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = env.SENTRY_ORG || process.env.SENTRY_ORG || "cliveux";
  const sentryProject = env.SENTRY_PROJECT || process.env.SENTRY_PROJECT || "king-g-system";

  return {
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
    build: {
      sourcemap: "hidden",
    },
    plugins: [
      react(),
      // After other plugins so instrumentation and source maps stay correct
      sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        disable: !sentryAuthToken,
        sourcemaps: {
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
