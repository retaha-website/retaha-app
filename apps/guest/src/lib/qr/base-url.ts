// Sprint E3 Phase 5 — Guest-Frontend-Base-URL
//
// Quelle für QR-Link-Generierung. Default für lokale Entwicklung, Production
// kommt aus ENV `PUBLIC_GUEST_BASE_URL`. Nach Sprint F (Monorepo-Split) zeigt
// das auf eine eigene Gast-App-Domain (z.B. app.retaha.de oder gast.retaha.de),
// aktuell liegt das Gast-Frontend noch im selben Astro-Projekt → fällt also
// auf die Request-Origin zurück.

export function getGuestBaseUrl(requestUrl?: string | URL): string {
  const env = import.meta.env.PUBLIC_GUEST_BASE_URL as string | undefined;
  if (env && env.length > 0) {
    return env.replace(/\/+$/, '');
  }
  if (requestUrl) {
    const u = typeof requestUrl === 'string' ? new URL(requestUrl) : requestUrl;
    return `${u.protocol}//${u.host}`;
  }
  return 'http://localhost:4321';
}

export function buildGuestStayUrl(token: string, requestUrl?: string | URL): string {
  return `${getGuestBaseUrl(requestUrl)}/g/${encodeURIComponent(token)}`;
}

export function buildGuestRoomUrl(roomCode: string, requestUrl?: string | URL): string {
  return `${getGuestBaseUrl(requestUrl)}/g/r/${encodeURIComponent(roomCode)}`;
}
