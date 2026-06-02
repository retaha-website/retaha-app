// @retaha/guest-app — app.retaha.de — Gast-Frontend (Hub, 8 Sheets, Eve-Chat, NFC-Routes)
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4322 },
  vite: {
    plugins: [tailwindcss()],
  },
});
