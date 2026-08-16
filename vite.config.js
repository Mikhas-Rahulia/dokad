import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Using relative base path makes it work universally on GitHub Pages, Cloudflare, or custom domains!
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
