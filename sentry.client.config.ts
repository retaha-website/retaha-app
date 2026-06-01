// Sprint Functional Modul E · Phase 11 — Sentry Client-Init
//
// DSGVO-Hardening:
// - sendDefaultPii: false   → kein User-Agent, IP, Cookies automatisch
// - beforeSend()            → entfernt request.data, cookies, sensible Headers
// - sendClientReports: false→ keine Client-Throttling-Reports (kein IP)
// - Keine Performance-Tracing, kein Replay
//
// Aktiv NUR wenn @sentry/astro-Integration im Build aktiviert wurde
// (siehe astro.config.mjs — ENABLE_SENTRY-Guard).

import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: import.meta.env.SENTRY_DSN,

  sendDefaultPii: false,
  attachStacktrace: true,
  sendClientReports: false,

  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend(event) {
    if (event.request) {
      // Request-Body kann personenbezogene Daten enthalten
      if ('data' in event.request) delete (event.request as any).data;
      if (event.request.cookies) delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-forwarded-for'];
        delete event.request.headers['x-real-ip'];
      }
    }
    // User-Object: erlaubt sind nur opaque IDs (in unserem setUser-Wrapper)
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
