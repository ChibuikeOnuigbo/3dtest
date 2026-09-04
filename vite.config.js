import { defineConfig } from 'vite';

// Arena previews are served through a per-session proxy host. Runtime APIs are all
// same-origin; allowing that host is required only for the development preview.
export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
