// @retaha/backoffice-app — backoffice.retaha.de — Hotelier-Config (Settings, Marketing, Themes)
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4324 },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: [
        'auth.retaha.local',
        'app.retaha.local',
        'dashboard.retaha.local',
        'backoffice.retaha.local',
      ],
    },
  },
});
