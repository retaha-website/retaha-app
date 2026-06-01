// Sprint Wallet Phase 4 — Pass-Class für ein Hotel zu Google submittieren.
//
// Usage:
//   npm run wallet:create-class -- <hotel_id> [--review]
//
//   --review: setzt reviewStatus=UNDER_REVIEW (Production, Google reviewed
//             dann manuell ~2-5 Tage). Ohne Flag: DRAFT (Developer-only,
//             sofort nutzbar für Test-Passes mit dem eigenen Wallet-Account).
//
// Idempotent: bei 409 (Class existiert schon) returnen wir success.

import { createPassClass } from '../src/lib/wallet/google';
import { createSupabaseServiceRoleInstance } from '../src/lib/auth';
import { getEnv } from '../src/lib/env';

const DEFAULT_BRAND_COLOR = '#1A1A1A';  // retaha-anthrazit
const PUBLIC_SITE = getEnv('PUBLIC_SITE_URL') || 'https://demo.retaha.de';

function absoluteUrl(maybeRelative: string | null): string | null {
  if (!maybeRelative) return null;
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  // Logo-Pfade wie "/hotel-assets/logo.svg" → vollständige URL
  const base = PUBLIC_SITE.replace(/\/$/, '');
  const path = maybeRelative.startsWith('/') ? maybeRelative : `/${maybeRelative}`;
  return base + path;
}

async function main() {
  const hotelId = process.argv[2];
  const reviewFlag = process.argv.includes('--review');

  if (!hotelId) {
    console.error('Usage: npm run wallet:create-class -- <hotel_id> [--review]');
    process.exit(1);
  }

  const sb = createSupabaseServiceRoleInstance();
  const { data: hotel, error } = await sb
    .from('hotels')
    .select('id, name, logo_url, brand_color, hero_image_url, default_language')
    .eq('id', hotelId)
    .maybeSingle();

  if (error || !hotel) {
    console.error('[wallet:create-class] Hotel nicht gefunden:', error?.message || hotelId);
    process.exit(1);
  }

  const input = {
    hotelId: hotel.id,
    hotelName: hotel.name,
    brandColorHex: hotel.brand_color || DEFAULT_BRAND_COLOR,
    logoUrl: absoluteUrl(hotel.logo_url),
    heroImageUrl: absoluteUrl(hotel.hero_image_url),
    defaultLang: hotel.default_language || 'de',
  };

  console.log('[wallet:create-class] submitting:');
  console.log(`  hotel:       ${input.hotelName} (${input.hotelId})`);
  console.log(`  brandColor:  ${input.brandColorHex}${hotel.brand_color ? '' : ' (default — hotels.brand_color ist NULL)'}`);
  console.log(`  logo:        ${input.logoUrl ?? 'NONE'}`);
  console.log(`  hero:        ${input.heroImageUrl ?? 'NONE'}`);
  console.log(`  reviewStatus: ${reviewFlag ? 'UNDER_REVIEW (Production-Submission)' : 'DRAFT (Developer-only)'}`);
  console.log();

  // Hack: createPassClass uses 'UNDER_REVIEW' fest. Wir patchen das hier
  // via eine extra-Option im input-shape NICHT — sondern wir setzen
  // env-temporär. Sauberer: createPassClass nimmt einen reviewStatus-Param.
  // Für jetzt: createPassClass beibehalten, aber wir warnen wenn DRAFT
  // erwartet wurde aber das Lib UNDER_REVIEW sendet.
  // → ich passe createPassClass um einen optionalen Param an.

  const result = await createPassClass({ ...input, reviewStatus: reviewFlag ? 'UNDER_REVIEW' : 'DRAFT' } as any);

  console.log('[wallet:create-class] result:', JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch(err => {
  console.error('[wallet:create-class] uncaught:', err);
  process.exit(1);
});
