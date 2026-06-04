// @retaha/auth-app — auth.retaha.de — Magic-Link-Empfänger, Login-UI, SSO-Cookie-Setter
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4321 },
  // i18n routing: /login = de (default), /en/login, /tr/login, etc.
  // prefixDefaultLocale=false -> Default-Locale ohne URL-Prefix
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en', 'tr', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ar', 'zh'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
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
