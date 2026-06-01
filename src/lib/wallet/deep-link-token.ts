// Sprint Wallet · Modul E — Signed Wallet-Deep-Link-Token
//
// Wallet-Pässe enthalten einen Deep-Link (Wallet-Detail-View → Web-Action):
//   https://app.retaha.de/g/wallet-open?pass=<HS256-JWT>
//
// Signiert HS256 mit STAY_SESSION_SECRET, audience='wallet-deep-link'.
// Eigene Audience verhindert Cross-Use mit Stay-Session / Pair-Token /
// Opt-Out-Token (Pattern wie Modul B).
//
// TTL: 30 Tage. Pass-Owner kann den Pass mehrfach öffnen — deshalb lange TTL.
// Wenn Pass im Wallet aktualisiert wird (z.B. Wiederkehrer-Sync), wird der
// Token mit-rotiert (neue exp), aber Decode-fähig solange noch nicht abgelaufen.

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { getEnv } from '../env';

const ALGORITHM = 'HS256';
const ISSUER = 'retaha';
const AUDIENCE = 'wallet-deep-link';
const DEFAULT_TTL_SECONDS = 30 * 24 * 3600;  // 30 Tage

export interface WalletDeepLinkPayload {
  wallet_pass_id: string;
  exp: number;
}

function getSecret(): Uint8Array | null {
  const raw = getEnv('STAY_SESSION_SECRET');
  if (!raw || raw.length < 32) {
    console.warn('[deep-link-token] STAY_SESSION_SECRET fehlt — Deep-Links inaktiv');
    return null;
  }
  return new TextEncoder().encode(raw);
}

export async function signWalletDeepLinkToken(
  walletPassId: string,
  ttlSeconds?: number,
): Promise<string | null> {
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

export async function verifyWalletDeepLinkToken(jwt: string): Promise<WalletDeepLinkPayload | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret, {
      algorithms: [ALGORITHM], issuer: ISSUER, audience: AUDIENCE,
    });
    if (typeof payload.wallet_pass_id !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    return { wallet_pass_id: payload.wallet_pass_id, exp: payload.exp };
  } catch (err) {
    if (!(err instanceof joseErrors.JOSEError)) {
      console.warn('[deep-link-token] verify unexpected:', (err as Error).message);
    }
    return null;
  }
}

/**
 * Konvenienz: vollständige Wallet-Deep-Link-URL für einen Pass.
 * Beispiel: https://demo.retaha.de/g/wallet-open?pass=...
 */
export async function buildWalletDeepLinkUrl(
  walletPassId: string,
  origin?: string,
): Promise<string | null> {
  const token = await signWalletDeepLinkToken(walletPassId);
  if (!token) return null;
  const base = (origin || getEnv('PUBLIC_SITE_URL') || 'https://demo.retaha.de').replace(/\/$/, '');
  return `${base}/g/wallet-open?pass=${encodeURIComponent(token)}`;
}
