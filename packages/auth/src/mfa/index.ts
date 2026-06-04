/**
 * @retaha/auth/mfa — TOTP + Recovery + Enforcement
 *
 * Server-side only (Node.js crypto + bcrypt). NICHT in Client-Bundle importieren.
 */

export {
  generateSecret,
  buildOtpAuthUrl,
  generateQrCodeDataUrl,
  verifyToken,
  currentTokenForDebug,
} from './totp.ts';

export {
  generateRecoveryCode,
  generateRecoveryCodes,
  hashCode,
  verifyCode,
  hashAllCodes,
  CODES_PER_USER,
  CODE_LENGTH,
} from './recovery-codes.ts';

export { encryptSecret, decryptSecret } from './encryption.ts';

export {
  logMfaEvent,
  parseUaFamily,
  parseDevice,
  type MfaEventType,
  type MfaAuditMetadata,
  type LogMfaEventInput,
} from './audit.ts';

export {
  getUserMfaStatus,
  getHotelMfaPolicy,
  setHotelMfaRequired,
  shouldRedirectToMfa,
  shouldForceSetup,
  type UserMfaStatus,
  type HotelMfaPolicy,
} from './enforcement.ts';
