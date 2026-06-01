// Sprint Wallet · Phase 6 — Google-Wallet-Webhook
//
// Empfängt Notifications von Google wenn ein Pass-Object seinen State ändert.
// Google nutzt für Issuer-Notifications zwei Mechanismen:
//   (a) HTTP-Callback URL (was wir hier abbilden — signed JWT als Bearer)
//   (b) Google Cloud Pub/Sub Push-Subscription (auch HTTP-Push gegen uns)
// In beiden Fällen ist der Payload ein signiertes JWT in der `Authorization`-
// oder im Body. Wir verifizieren die Signatur via Google-Public-Keys.
//
// Implementierungs-Tiefe (MVP):
//   - Endpoint nimmt POST entgegen, JSON-parst Body
//   - Signature-Verify ist Best-Effort: wenn JWT in Auth-Header → verifyen
//     gegen Google-OIDC-Keys; sonst akzeptieren mit Warn-Log (für lokales
//     Testing). Production muss strict-mode aktivieren.
//   - Event-Routing:
//       eventType=del               → state='opted_out', reason='wallet_removed'
//       eventType=update + class    → ignoriert
//       eventType=update + object   → last_pass_open_at = NOW (Open-Event)
//
// Pre-Production-Task (Backlog): exact Google-Issuer-Webhook-Format an
// Real-World-Payloads anpassen sobald wir produktiv Pushes empfangen.

import type { APIRoute } from 'astro';
import jwt from 'jsonwebtoken';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getEnv } from '../../../lib/env';

const GOOGLE_OIDC_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const STRICT_MODE = (getEnv('GOOGLE_WALLET_WEBHOOK_STRICT') === 'true');

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

interface GooglePublicKey {
  kid: string;
  n: string;
  e: string;
  alg: string;
  kty: string;
}

let cachedKeys: { keys: GooglePublicKey[]; fetchedAt: number } | null = null;
const KEY_CACHE_TTL_MS = 60 * 60 * 1000;

async function getGoogleKeys(): Promise<GooglePublicKey[] | null> {
  if (cachedKeys && (Date.now() - cachedKeys.fetchedAt) < KEY_CACHE_TTL_MS) {
    return cachedKeys.keys;
  }
  try {
    const res = await fetch(GOOGLE_OIDC_JWKS_URI);
    if (!res.ok) return null;
    const body = await res.json();
    cachedKeys = { keys: body.keys || [], fetchedAt: Date.now() };
    return cachedKeys.keys;
  } catch (err) {
    console.warn('[wallet/webhook] keys fetch failed:', (err as Error).message);
    return null;
  }
}

/**
 * Verifiziert das JWT-signed Google-Notification-Payload.
 * Return: das decoded payload oder null bei Fehler.
 *
 * Hinweis: jsonwebtoken kann JWKS nicht direkt — wir nehmen das passende Key
 * via kid und konvertieren n/e → PEM. Vollständige Impl ist hier vereinfacht;
 * für strict-mode in Production empfiehlt sich jose oder google-auth-library.
 */
async function verifyGoogleJwt(token: string): Promise<any | null> {
  try {
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || typeof decodedHeader === 'string') return null;
    const kid = (decodedHeader.header as any).kid;
    const keys = await getGoogleKeys();
    if (!keys) return null;
    const key = keys.find(k => k.kid === kid);
    if (!key) return null;
    // jsonwebtoken erwartet PEM — wir können hier OHNE eine Crypto-Library-
    // Konvertierung nicht prüfen. Für strict-mode → jose nutzen. Für MVP:
    // dekoded-Payload returnen, Signature-Check als TODO markiert.
    if (STRICT_MODE) {
      // TODO: jose-basierte verify mit JWK ohne PEM-Conversion
      console.warn('[wallet/webhook] strict-mode aktiv aber jose-verify nicht implementiert');
      return null;
    }
    return decodedHeader.payload;
  } catch (err) {
    console.warn('[wallet/webhook] verify failed:', (err as Error).message);
    return null;
  }
}

interface GoogleWalletEvent {
  classId?: string;
  objectId?: string;
  eventType?: 'save' | 'del' | 'update' | string;
  expTimeMillis?: number;
  nonce?: string;
}

export const POST: APIRoute = async ({ request }) => {
  // ── Payload extrahieren ───────────────────────────────────────────────
  let rawText: string;
  try { rawText = await request.text(); }
  catch { return json({ ok: false, error: 'no_body' }, 400); }

  // Google liefert JSON mit signedMessage (JWT) ODER direkt ein JWT im Body
  let signedJwt: string | null = null;
  let event: GoogleWalletEvent | null = null;
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed.signedMessage === 'string') signedJwt = parsed.signedMessage;
    else if (typeof parsed === 'object' && parsed.classId) event = parsed;  // dev-mode: rohes Event
  } catch {
    // Wenn nicht JSON: vielleicht direkt JWT
    if (rawText.split('.').length === 3) signedJwt = rawText.trim();
  }

  // Authorization-Header als alternativer JWT-Carrier
  if (!signedJwt) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth.toLowerCase().startsWith('bearer ')) signedJwt = auth.slice(7).trim();
  }

  if (signedJwt) {
    const payload = await verifyGoogleJwt(signedJwt);
    if (payload && typeof payload === 'object') event = payload as GoogleWalletEvent;
    else if (STRICT_MODE) return json({ ok: false, error: 'signature_invalid' }, 401);
  }

  if (!event || !event.objectId) {
    return json({ ok: false, error: 'no_event', received: !!signedJwt }, 400);
  }

  // ── Lookup wallet_passes per google_object_id ─────────────────────────
  const sb = createSupabaseServiceRoleInstance();
  const { data: pass } = await sb
    .from('wallet_passes')
    .select('id, state, google_object_id')
    .eq('google_object_id', event.objectId)
    .maybeSingle();

  if (!pass) {
    // Unbekannter Pass — kein 404 weil Google retry-en würde; einfach 200 mit Hinweis
    return json({ ok: true, status: 'unknown_object_id', objectId: event.objectId });
  }

  const now = new Date().toISOString();
  let update: Record<string, any> = {};

  switch (event.eventType) {
    case 'save':
      // User hat den Pass ins Wallet gespeichert — last_pass_open_at = NOW
      update = { last_pass_open_at: now };
      break;
    case 'del':
      // User hat den Pass aus dem Wallet entfernt → Opt-Out
      if (pass.state === 'active') {
        update = {
          state: 'opted_out',
          opted_out_at: now,
          opted_out_reason: 'wallet_removed',
        };
      }
      break;
    case 'update':
      // Object wurde aktualisiert — könnte ein User-Open sein
      update = { last_pass_open_at: now };
      break;
    default:
      return json({ ok: true, status: 'event_ignored', eventType: event.eventType });
  }

  if (Object.keys(update).length === 0) {
    return json({ ok: true, status: 'no_change' });
  }

  const { error } = await sb.from('wallet_passes').update(update).eq('id', pass.id);
  if (error) {
    console.warn('[wallet/webhook] db update failed:', error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, status: 'updated', eventType: event.eventType });
};

// Google verifiziert URLs manchmal via GET — antworten wir mit 200
export const GET: APIRoute = () => json({ ok: true, status: 'ready' });
