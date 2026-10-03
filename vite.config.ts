import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs ("../assets/...") instead of absolute ones.
  // The packaged desktop app is loaded over file://, where a leading slash
  // resolves to the filesystem root (C:\assets\...) instead of the app
  // folder, so the bundle would never load and the window renders blank.
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  css: {
    postcss: {},
    preprocessorOptions: {},
    // Use esbuild for CSS minification instead of lightningcss
  },
  build: {
    cssMinify: 'esbuild',
  },
});