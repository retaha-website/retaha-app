// Sprint C · Phase 4 — E2E Negativ-Test Verifikation
// Zeigt aktuelle bookings für den Test-Stay, ungeachtet ob mews_integrations da ist.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_STAY_ID = '36a5e8cd-3939-4a18-96b8-bb0faff9908a';

// mews_integrations Stand
const { data: integrations } = await supabase
  .from('mews_integrations')
  .select('hotel_id, enterprise_id, default_currency, default_tax_code, pricing_mode')
  .limit(5);

console.log('═'.repeat(70));
console.log(' mews_integrations rows:');
console.log('═'.repeat(70));
console.log(JSON.stringify(integrations, null, 2));

// Bookings für Test-Stay
const { data: bookings } = await supabase
  .from('bookings')
  .select('id, type, status, details, mews_order_id, mews_push_error, mews_push_attempted_at, created_at, updated_at')
  .eq('stay_id', TEST_STAY_ID)
  .order('created_at', { ascending: false });

console.log('');
console.log('═'.repeat(70));
console.log(' Bookings für Test-Stay:');
console.log('═'.repeat(70));
for (const b of bookings ?? []) {
  console.log('');
  console.log('Booking:        ', b.id);
  console.log('  type:         ', b.type);
  console.log('  status:       ', b.status);
  console.log('  created:      ', b.created_at);
  console.log('  updated:      ', b.updated_at);
  console.log('  push_attempt: ', b.mews_push_attempted_at ?? '(never)');
  console.log('  mews_order:   ', b.mews_order_id ?? '(none)');
  console.log('  push_error:   ', b.mews_push_error ?? '(none)');
  console.log('  details:      ', JSON.stringify(b.details));
}
