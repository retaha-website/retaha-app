// Sprint Wallet · Phase 7 — Signed Opt-Out-Token
//
// Jeder Marketing-Push enthält einen signierten Opt-Out-Link:
//   https://demo.retaha.de/wallet/opt-out?token=<HS256-JWT>
//
// Token-Payload: { wallet_pass_id, exp }
// Algorithmus: HS256 mit STAY_SESSION_SECRET (existierender Server-Secret).
// Audience: "wallet-opt-out" — explizit anders als Stay-Session/Pair-Token,
// damit ein Opt-Out-Token NICHT als Auth-Cookie missbraucht werden kann.
//
// TTL: 1 Jahr — Opt-Out-Links müssen lange gültig sein, weil Push-Empfänger
// die Notification ggf. später öffnen. State-Wechsel ist eh idempotent
// (mehrfaches Opt-Out tut nichts Böses).

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { getEnv } from '@retaha/db';

const ALGORITHM = 'HS256';
const ISSUER = 'retaha';
const AUDIENCE = 'wallet-opt-out';
const DEFAULT_TTL_SECONDS = 365 * 24 * 3600;  // 1 Jahr

export interface OptOutTokenPayload {
  wallet_pass_id: string;
  exp: number;
}

function getSecret(): Uint8Array | null {
  const raw = getEnv('STAY_SESSION_SECRET');
  if (!raw || raw.length < 32) {
    console.warn('[opt-out-token] STAY_SESSION_SECRET fehlt — Opt-Out-Links inaktiv');
    return null;
  }
  return new TextEncoder().encode(raw);
}

export async function signOptOutToken(walletPassId: string, ttlSeconds?: number): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  return new SignJWT({ wallet_pass_id: walletPassId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds ?? DEFAULT_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyOptOutToken(jwt: string): Promise<OptOutTokenPayload | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.wallet_pass_id !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    return { wallet_pass_id: payload.wallet_pass_id, exp: payload.exp };
  } catch (err) {
    if (!(err instanceof joseErrors.JOSEError)) {
      console.warn('[opt-out-token] verify unexpected error:', (err as Error).message);
    }
    return null;
  }
}

/**
 * Konvenienz: vollständige Opt-Out-URL für einen Wallet-Pass.
 * Beispiel: https://demo.retaha.de/wallet/opt-out?token=...
 */
export async function buildOptOutUrl(walletPassId: string, origin?: string): Promise<string | null> {
  const token = await signOptOutToken(walletPassId);
  if (!token) return null;
  const base = (origin || getEnv('PUBLIC_SITE_URL') || 'https://demo.retaha.de').replace(/\/$/, '');
  return `${base}/wallet/opt-out?token=${encodeURIComponent(token)}`;
}
