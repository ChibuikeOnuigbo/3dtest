import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] }
      }
    }
  }
});
