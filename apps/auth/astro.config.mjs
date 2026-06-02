// @retaha/auth-app — auth.retaha.de — Magic-Link-Empfänger, Login-UI, SSO-Cookie-Setter
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4321 },
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
