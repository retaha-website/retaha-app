// Sprint Functional Modul E · Phase 11 — Sentry Test-Endpoint
//
// Wirft absichtlich einen Error damit das Event in Sentry landet und Taha
// die Integration verifizieren kann. Nach Verifikation: diese Datei löschen
// (oder hier 404 zurückgeben). Auth-protected damit niemand von außen Sentry
// volltexten kann.

import type { APIRoute } from 'astro';
import { getUser } from '@retaha/auth';

export const GET: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) {
    return new Response('Forbidden', { status: 403 });
  }
  throw new Error('Sentry-Test-Error — kann nach Verifikation gelöscht werden (Sprint Functional Modul E)');
};
