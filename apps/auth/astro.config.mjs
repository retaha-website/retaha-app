// @retaha/auth-app — auth.retaha.de — Magic-Link-Empfänger, Login-UI, SSO-Cookie-Setter
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4321 },
  // i18n-Routing wird in src/middleware.ts gemacht (Astro i18n-Config produzierte
  // 404 in SSR + Vercel-Adapter weil keine echten [locale]/page.astro Files
  // existieren). Middleware extrahiert /en/, /tr/, etc. aus URL und macht
  // context.rewrite() zur Page ohne Lang-Prefix.
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
