import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "liquid-glass-ui": path.resolve(__dirname, "./src/lib/liquid-glass-ui.tsx"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-slot', '@radix-ui/react-tooltip'],
          'vendor-query': ['@tanstack/react-query'],
          // Feature chunks
          'admin': [
            './src/pages/AdminDashboard.tsx',
            './src/pages/AdminEvents.tsx',
            './src/pages/AdminVenues.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
