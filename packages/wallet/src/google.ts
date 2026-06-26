// Sprint Wallet · Phase 1 — Google Wallet API Wrapper
//
// Stellt die 4 wesentlichen Operationen für CRM-Wallet-Passes bereit:
//
//   1. createPassClass(hotel)       – Pass-Template-Definition (1× pro Hotel)
//   2. createPassObject(pass)       – Pass-Instance pro Gast (UPSERT-fähig)
//   3. updatePassObject(pass)       – State-Updates (visit_count, last_visit_at)
//   4. signSaveLink(passObject)     – "Add to Google Wallet"-JWT-URL
//
// Alle Funktionen sind best-effort: wenn Wallet nicht konfiguriert (kein
// Issuer/Service-Account in ENV), wird ein definierter Status zurückgegeben
// statt zu crashen. Caller können `isWalletConfigured()` checken oder den
// Return-Status auswerten.
//
// Implementierungs-Status (Sprint Wallet Phase 1):
// - createPassClass: implementiert (API-Endpoint v1 issuer-side)
// - createPassObject: implementiert (Object-Insert via API)
// - updatePassObject: implementiert (Object-Patch)
// - signSaveLink: implementiert (RS256-signierter JWT mit eingebettetem PassObject)
//
// !! ABHÄNGIG VON GOOGLE ISSUER APPROVAL !! Bis Approval da ist, schlagen
// alle API-Calls mit 401/403 fehl. Approval-Status: Pre-Sprint-Task Taha.

import { JWT } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { getWalletConfig, buildPassClassId, buildPassObjectId, type WalletConfig } from './config';

const WALLET_API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SAVE_LINK_BASE = 'https://pay.google.com/gp/v/save';
const WALLET_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

// ─── Auth-Client (cached) ──────────────────────────────────────────────────

let authClient: JWT | null = null;
function getAuthClient(cfg: WalletConfig): JWT {
  if (authClient) return authClient;
  authClient = new JWT({
    email: cfg.serviceAccount.client_email,
    key: cfg.serviceAccount.private_key,
    scopes: [WALLET_SCOPE],
  });
  return authClient;
}

async function getAccessToken(cfg: WalletConfig): Promise<string | null> {
  try {
    const client = getAuthClient(cfg);
    const tokenResp = await client.getAccessToken();
    return tokenResp.token ?? null;
  } catch (err) {
    console.warn('[wallet/google] getAccessToken failed:', (err as Error).message);
    return null;
  }
}

// ─── Pass-Class (1× pro Hotel) ─────────────────────────────────────────────

export interface PassClassInput {
  hotelId: string;
  hotelName: string;
  brandColorHex: string;       // z.B. "#FF4A82"
  logoUrl: string | null;
  heroImageUrl: string | null;
  defaultLang: string;          // ISO 2-letter, z.B. "de"
  /**
   * 'DRAFT': Developer-only, sofort nutzbar mit Issuer-Account zum Test
   * 'UNDER_REVIEW': Production-Submission, Google reviewed manuell (~2-5 Tage)
   * Default: 'DRAFT' (safer).
   */
  reviewStatus?: 'DRAFT' | 'UNDER_REVIEW';
}

export interface PassClassResult {
  ok: boolean;
  classId: string;
  status: 'created' | 'already_exists' | 'not_configured' | 'auth_failed' | 'http_error';
  httpStatus?: number;
  message?: string;
}

/**
 * Erstellt eine Pass-Class für ein Hotel. Idempotent: existiert bereits eine
 * Class mit derselben ID, gibt Google 409 zurück — wir reporten 'already_exists'.
 *
 * Pass-Class-IDs müssen pro Issuer-Account global unique sein. Wir verwenden
 * buildPassClassId(issuerId, hotelId) — 1:1 Mapping hotel ↔ class.
 */
export async function createPassClass(input: PassClassInput): Promise<PassClassResult> {
  const cfg = getWalletConfig();
  const classId = cfg ? buildPassClassId(cfg.issuerId, input.hotelId) : `unknown.hotel_${input.hotelId}`;
  if (!cfg) return { ok: false, classId, status: 'not_configured' };

  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, classId, status: 'auth_failed' };

  const cardRows: any[] = [
    // Zeile 1: Loyalty-Status (nur sichtbar wenn Objekt ein 'tier'-Feld hat)
    {
      oneItem: {
        item: {
          firstValue: { fields: [{ fieldPath: 'object.textModulesData["tier"]' }] },
        },
      },
    },
    // Zeile 2: Mitglied seit | Besuche
    {
      twoItems: {
        startItem: {
          firstValue: { fields: [{ fieldPath: 'object.textModulesData["member_since"]' }] },
        },
        endItem: {
          firstValue: { fields: [{ fieldPath: 'object.textModulesData["visit_count"]' }] },
        },
      },
    },
    // Zeile 3: Letzter Besuch
    {
      oneItem: {
        item: {
          firstValue: { fields: [{ fieldPath: 'object.textModulesData["last_visit"]' }] },
        },
      },
    },
  ];

  const body = {
    id: classId,
    issuerName: input.hotelName,
    reviewStatus: input.reviewStatus ?? 'DRAFT',
    programName: input.hotelName,
    programLogo: input.logoUrl ? {
      sourceUri: { uri: input.logoUrl },
      contentDescription: { defaultValue: { language: input.defaultLang, value: `${input.hotelName} logo` } },
    } : undefined,
    hexBackgroundColor: input.brandColorHex,
    heroImage: input.heroImageUrl ? {
      sourceUri: { uri: input.heroImageUrl },
      contentDescription: { defaultValue: { language: input.defaultLang, value: `${input.hotelName} hero` } },
    } : undefined,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: cardRows,
      },
    },
    // Marketing-Push-Capability — der Pass darf Push-Notifications senden
    multipleDevicesAndHoldersAllowedStatus: 'MULTIPLE_HOLDERS',
  };

  try {
    const res = await fetch(`${WALLET_API_BASE}/loyaltyClass`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      return { ok: true, classId, status: 'already_exists', httpStatus: 409 };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false, classId, status: 'http_error', httpStatus: res.status,
        message: text.slice(0, 500),
      };
    }
    return { ok: true, classId, status: 'created', httpStatus: res.status };
  } catch (err) {
    return { ok: false, classId, status: 'http_error', message: (err as Error).message };
  }
}

// ─── Pass-Object (per Gast) ────────────────────────────────────────────────

export interface PassObjectInput {
  walletPassUuid: string;        // wallet_passes.id → wird zum object-id-Suffix
  hotelId: string;
  hotelName: string;
  guestFirstName: string | null;
  guestLastName: string | null;
  visitCount: number;
  firstVisitAt: Date;
  lastVisitAt: Date | null;
  defaultLang: string;
  tier?: string;                 // Loyalty-Stufen-Name (z.B. "Gold"), optional
}

export interface PassObjectResult {
  ok: boolean;
  objectId: string;
  classId: string;
  status: 'created' | 'already_exists' | 'not_configured' | 'auth_failed' | 'http_error';
  httpStatus?: number;
  message?: string;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);  // YYYY-MM-DD
}

function buildObjectBody(input: PassObjectInput, cfg: WalletConfig): any {
  const classId = buildPassClassId(cfg.issuerId, input.hotelId);
  const objectId = buildPassObjectId(cfg.issuerId, input.walletPassUuid);
  const guestName = [input.guestFirstName, input.guestLastName].filter(Boolean).join(' ').trim() || 'Gast';
  return {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountId: input.walletPassUuid,
    accountName: guestName,
    textModulesData: [
      ...(input.tier ? [{
        id: 'tier',
        header: 'Status',
        body: input.tier,
      }] : []),
      {
        id: 'member_since',
        header: 'Mitglied seit',
        body: fmtDate(input.firstVisitAt),
      },
      {
        id: 'visit_count',
        header: 'Besuche',
        body: String(input.visitCount),
      },
      {
        id: 'last_visit',
        header: 'Letzter Besuch',
        body: input.lastVisitAt ? fmtDate(input.lastVisitAt) : '—',
      },
    ],
    locations: [],
  };
}

export async function createPassObject(input: PassObjectInput): Promise<PassObjectResult> {
  const cfg = getWalletConfig();
  const objectId = cfg ? buildPassObjectId(cfg.issuerId, input.walletPassUuid) : `unknown.pass_${input.walletPassUuid}`;
  const classId = cfg ? buildPassClassId(cfg.issuerId, input.hotelId) : `unknown.hotel_${input.hotelId}`;
  if (!cfg) return { ok: false, objectId, classId, status: 'not_configured' };

  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, objectId, classId, status: 'auth_failed' };

  try {
    const res = await fetch(`${WALLET_API_BASE}/loyaltyObject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildObjectBody(input, cfg)),
    });
    if (res.status === 409) {
      return { ok: true, objectId, classId, status: 'already_exists', httpStatus: 409 };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, objectId, classId, status: 'http_error', httpStatus: res.status, message: text.slice(0, 500) };
    }
    return { ok: true, objectId, classId, status: 'created', httpStatus: res.status };
  } catch (err) {
    return { ok: false, objectId, classId, status: 'http_error', message: (err as Error).message };
  }
}

/**
 * State-Update für existierenden Pass (Wiederkehrer: visit_count, last_visit).
 * Verwendet PATCH (nur die spezifizierten Felder werden überschrieben).
 */
export async function updatePassObject(input: PassObjectInput): Promise<PassObjectResult> {
  const cfg = getWalletConfig();
  const objectId = cfg ? buildPassObjectId(cfg.issuerId, input.walletPassUuid) : `unknown.pass_${input.walletPassUuid}`;
  const classId = cfg ? buildPassClassId(cfg.issuerId, input.hotelId) : `unknown.hotel_${input.hotelId}`;
  if (!cfg) return { ok: false, objectId, classId, status: 'not_configured' };

  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, objectId, classId, status: 'auth_failed' };

  try {
    const res = await fetch(`${WALLET_API_BASE}/loyaltyObject/${encodeURIComponent(objectId)}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildObjectBody(input, cfg)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, objectId, classId, status: 'http_error', httpStatus: res.status, message: text.slice(0, 500) };
    }
    return { ok: true, objectId, classId, status: 'created', httpStatus: res.status };
  } catch (err) {
    return { ok: false, objectId, classId, status: 'http_error', message: (err as Error).message };
  }
}

// ─── Save-Link (Add to Google Wallet) ──────────────────────────────────────

export interface SaveLinkResult {
  ok: boolean;
  url: string | null;
  status: 'ok' | 'not_configured';
}

/**
 * Generiert eine signed "Save to Google Wallet"-URL. JWT enthält das komplette
 * PassObject als embedded payload — kein API-Call nötig, der Browser löst den
 * Pass ein wenn der Gast den Link öffnet.
 *
 * Der JWT muss MIT dem Service-Account-Key signiert sein (RS256).
 * Audience = "google", Issuer = service-account-email, Type = "savetowallet".
 *
 * Use-Case: Frontend zeigt einen Button → click öffnet die URL → Google Wallet
 * fragt den Gast "Pass hinzufügen?" → Pass im Wallet.
 */
export function signSaveLink(input: PassObjectInput, origins: string[] = ['https://demo.retaha.de']): SaveLinkResult {
  const cfg = getWalletConfig();
  if (!cfg) return { ok: false, url: null, status: 'not_configured' };

  const objectPayload = buildObjectBody(input, cfg);
  const claims = {
    iss: cfg.serviceAccount.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins,
    payload: {
      loyaltyObjects: [objectPayload],
    },
  };

  const signed = jwt.sign(claims, cfg.serviceAccount.private_key, { algorithm: 'RS256' });
  return { ok: true, url: `${SAVE_LINK_BASE}/${signed}`, status: 'ok' };
}

// ─── Pass-Notification (Phase 10: Marketing-Push via Google Wallet) ───────

export interface PassMessageInput {
  walletPassUuid: string;
  hotelId: string;
  header: string;            // Notification-Titel (kurz, max ~50 Zeichen)
  body: string;              // Notification-Body
  messageId?: string;        // optional: UUID für Dedup (Re-Send → kein Doppel-Push)
}

export interface PassMessageResult {
  ok: boolean;
  objectId: string;
  status: 'sent' | 'not_configured' | 'auth_failed' | 'http_error' | 'object_not_found';
  httpStatus?: number;
  message?: string;
}

/**
 * Schickt eine Notification an einen einzelnen Pass-Object.
 *
 * Google-API: POST /loyaltyObject/{objectId}/addMessage
 * messageType=TEXT_AND_NOTIFY triggert eine Push-Notification auf dem Gerät;
 * messageType=TEXT zeigt sie nur im Pass-Detail.
 *
 * Bei 404: Pass-Object existiert nicht mehr (User hat ihn entfernt oder Pass
 * wurde nie angelegt). Caller sollte den Pass in der DB als state='opted_out'
 * markieren — passiert aber separat im Send-Loop um Race-Conditions zu vermeiden.
 */
export async function addMessageToPass(input: PassMessageInput): Promise<PassMessageResult> {
  const cfg = getWalletConfig();
  const objectId = cfg ? buildPassObjectId(cfg.issuerId, input.walletPassUuid) : `unknown.pass_${input.walletPassUuid}`;
  if (!cfg) return { ok: false, objectId, status: 'not_configured' };

  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, objectId, status: 'auth_failed' };

  const body = {
    message: {
      id: input.messageId,                // optional dedup key
      header: input.header.slice(0, 60),  // Google empfiehlt kurz
      body: input.body.slice(0, 1024),    // hard limit
      messageType: 'TEXT_AND_NOTIFY',
    },
  };

  try {
    const res = await fetch(
      `${WALLET_API_BASE}/loyaltyObject/${encodeURIComponent(objectId)}/addMessage`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (res.status === 404) {
      return { ok: false, objectId, status: 'object_not_found', httpStatus: 404 };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, objectId, status: 'http_error', httpStatus: res.status, message: text.slice(0, 500) };
    }
    return { ok: true, objectId, status: 'sent', httpStatus: res.status };
  } catch (err) {
    return { ok: false, objectId, status: 'http_error', message: (err as Error).message };
  }
}

// ─── Convenience: für Tests ────────────────────────────────────────────────

/**
 * Smoke-Test: pingt das Wallet-API mit dem Service-Account und returnt ob die
 * Auth funktioniert. Kann nach Issuer-Approval von einem Admin-Endpoint
 * aufgerufen werden (kommt in Folge-Session).
 */
export async function pingWalletAuth(): Promise<{ ok: boolean; reason: string }> {
  const cfg = getWalletConfig();
  if (!cfg) return { ok: false, reason: 'not_configured' };
  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, reason: 'auth_failed' };
  return { ok: true, reason: 'token_acquired' };
}
