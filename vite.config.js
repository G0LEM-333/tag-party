import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    allowedHosts: true,                       // lets the cloudflared tunnel hostname through
    proxy: { '/ws': { target: 'ws://localhost:3001', ws: true } },   // dev: game server runs on :3001
  },
});
