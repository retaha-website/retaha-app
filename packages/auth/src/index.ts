// @retaha/auth
// Permission-Helper, Session-Cookie-Setter, Cross-Subdomain SSO
//
// Phase B Sprint F: Code aus src/lib/auth.ts + src/lib/auth/* kopiert.
// NEU: cross-subdomain-cookie für SSO via auth.retaha.de.

// Supabase-Server-Clients (Cookie-bound + Service-Role)
export {
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
  getUser,
  getUserHotels,
} from './server';

// Permissions (Sprint Functional) — alle exports
export * from './permissions';

export * from './require-permission';

// Stay-Session (JWT-Cookie für Gast-Frontend via /g/[token])
export * from './stay-session';

// Encryption (AES-256-GCM für Mews-Token-Storage)
export { encryptToken, decryptToken } from './encryption';

// User-Profile-Helpers
export { hotelOwnerFirstName } from './user-profile';

// Cross-Subdomain SSO-Cookie (Sprint F)
export {
  SESSION_COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  buildLoginRedirect,
  type SessionCookieOptions,
} from './cross-subdomain-cookie';

// Branding-Data Helper
export { getBranding } from './branding';
export type { BrandingData } from './branding';

// Showcase-Session Helper
export { getOrCreateShowcaseUrl } from './showcase';

// MFA (Sprint-I Findings-Fix) — Server-side only
// Importpfad: import { ... } from '@retaha/auth/mfa'
// (NICHT vom root '@retaha/auth' damit Client-Bundles bcrypt nicht ziehen)
