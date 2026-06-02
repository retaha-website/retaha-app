// @retaha/dashboard-app — dashboard.retaha.de — Hotelier-Operations (Daily-Business)
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: 4323 },
  vite: {
    plugins: [tailwindcss()],
  },
});
