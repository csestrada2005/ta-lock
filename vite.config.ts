import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isWidgetBuild = mode === "widget";

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // Widget library build — outputs a single JS file that registers <ask-tetr-widget>
    ...(isWidgetBuild && {
      build: {
        lib: {
          entry: path.resolve(__dirname, "src/widget.tsx"),
          name: "AskTetrWidget",
          fileName: "ask-tetr-widget",
          formats: ["es", "umd"] as const,
        },
        rollupOptions: {
          // Bundle everything (React included) so the host page needs zero deps
          external: [],
          output: {
            // Inline all CSS into JS for Shadow DOM injection
            assetFileNames: "ask-tetr-widget.[ext]",
          },
        },
        cssCodeSplit: false,
        outDir: "dist-widget",
      },
    }),
  };
});
