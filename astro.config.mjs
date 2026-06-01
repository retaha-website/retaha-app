// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sentry from '@sentry/astro';

// Sprint Functional Modul E · Phase 11 — Sentry nur in Production aktivieren.
// Dev-Errors müssen lokal sichtbar bleiben (Console/Network), nicht Sentry-Quota
// verbrennen. Sentry-Integration nur einhängen wenn DSN gesetzt UND prod-Build.
const SENTRY_DSN = process.env.SENTRY_DSN;
const ENABLE_SENTRY = !!SENTRY_DSN && process.env.NODE_ENV === 'production';

/** @type {import('astro').AstroIntegration[]} */
const integrations = [];
if (ENABLE_SENTRY) {
  integrations.push(sentry({
    dsn: SENTRY_DSN,
    // Source-Maps-Upload zu Sentry funktioniert nur mit Auth-Token (ENV).
    // Ohne Token: kein Upload, Stack-Traces im Dashboard sind minifiziert.
    sourceMapsUploadOptions: process.env.SENTRY_AUTH_TOKEN ? {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    } : { telemetry: false },
  }));
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false }
  }),
  integrations,
  vite: {
    plugins: [tailwindcss()]
  }
});
