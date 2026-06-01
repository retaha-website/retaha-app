// Sprint Functional Modul E · Phase 11 — Sentry Server-Init
//
// Server-seitige Variante mit identischem DSGVO-Hardening. Zusätzlich gefiltert:
// - Request-Header "authorization", "cookie", "x-forwarded-for"
// - JSON-Body (kann Stay-Tokens, Booking-Details enthalten)

import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: import.meta.env.SENTRY_DSN,

  sendDefaultPii: false,
  attachStacktrace: true,
  sendClientReports: false,

  tracesSampleRate: 0,

  beforeSend(event) {
    if (event.request) {
      if ('data' in event.request) delete (event.request as any).data;
      if (event.request.cookies) delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-forwarded-for'];
        delete event.request.headers['x-real-ip'];
      }
      // Query-String kann access_token enthalten (Gast-Magic-Links)
      if (event.request.query_string) event.request.query_string = '[redacted]';
    }
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
