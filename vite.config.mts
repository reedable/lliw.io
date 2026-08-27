import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(CONFIG_DIR, './src');
const PUBLIC_DIR = path.resolve(CONFIG_DIR, './public');
const BUILD_DIR = path.resolve(CONFIG_DIR, './www');

export default defineConfig({
  plugins: [react()],
  root: SRC_DIR,
  // GitHub Pages serves this repo at https://reedable.github.io/lliw.io/.
  // Kept the same in dev so the dev server URL matches production; vite prints
  // http://localhost:5173/lliw.io/ on start.
  base: '/lliw.io/',
  publicDir: PUBLIC_DIR,
  build: {
    outDir: BUILD_DIR,
    assetsInlineLimit: 0,
    emptyOutDir: true,
    rollupOptions: {
      treeshake: false,
    },
  },
  resolve: {
    alias: {
      '@': SRC_DIR,
    },
  },
  server: {
    host: true,
  },
});
