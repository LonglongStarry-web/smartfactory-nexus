import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ["index.html"] },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["echarts"],
          three: ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
