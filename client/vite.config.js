import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiOrigin = process.env.VITE_API_ORIGIN || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: { usePolling: true }, // nécessaire avec les bind mounts Docker
    proxy: {
      '/api': { target: apiOrigin },
      '/socket.io': { target: apiOrigin, ws: true },
    },
  },
});
