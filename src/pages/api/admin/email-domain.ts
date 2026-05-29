// Sprint D · Phase 7 — Email-Custom-Domain Management
//
// POST /api/admin/email-domain mit _action ∈ {add, verify, remove}:
//   - add:    Domain bei Resend anlegen, ID + DNS-Records in hotel_settings speichern
//   - verify: Resend Verify-Endpoint aufrufen, status updaten
//   - remove: bei Resend löschen, hotel_settings auf NULL
//
// Auth: SSR-Session + Hotel-Lookup. Resend-Calls via Service-Role-Update auf
// hotel_settings (RLS auf user nicht abhängig).

import type { APIRoute } from 'astro';
import {
  getUser,
  getUserHotels,
  createSupabaseServiceRoleInstance,
} from '../../../lib/auth';
import {
  resendAddDomain,
  resendGetDomain,
  resendVerifyDomain,
  resendDeleteDomain,
} from '../../../lib/email/resend';

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z]{2,}){1,2}$/i;

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  const user = await getUser(cookies, request);
  if (!user) return redirect('/admin/login', 303);
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return redirect('/admin/login?error=no_hotel', 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect('/admin/email-domain?err=invalid_form', 303);
  }

  const action = form.get('_action')?.toString();
  const admin = createSupabaseServiceRoleInstance();

  // ── ADD ──────────────────────────────────────────────────────────────
  if (action === 'add') {
    const domain = form.get('domain')?.toString().trim().toLowerCase() ?? '';
    if (!domain) {
      return redirect('/admin/email-domain?err=no_domain', 303);
    }
    if (!DOMAIN_REGEX.test(domain)) {
      return redirect('/admin/email-domain?err=invalid_domain', 303);
    }

    const resp = await resendAddDomain(domain);
    if (!resp.ok) {
      return redirect(`/admin/email-domain?err=resend&detail=${encodeURIComponent(resp.error)}`, 303);
    }

    const { error: updateErr } = await admin
      .from('hotel_settings')
      .update({
        custom_email_domain: domain,
        custom_email_status: 'pending',
        resend_domain_id: resp.data.id,
      })
      .eq('hotel_id', hotel.id);

    if (updateErr) {
      console.error('[email-domain] hotel_settings update failed:', updateErr);
      return redirect('/admin/email-domain?err=db_save', 303);
    }
    return redirect('/admin/email-domain?saved=added', 303);
  }

  // ── VERIFY ──────────────────────────────────────────────────────────
  if (action === 'verify') {
    const { data: row } = await admin
      .from('hotel_settings')
      .select('resend_domain_id')
      .eq('hotel_id', hotel.id)
      .maybeSingle();

    if (!row?.resend_domain_id) {
      return redirect('/admin/email-domain?err=no_domain_id', 303);
    }

    const resp = await resendVerifyDomain(row.resend_domain_id);
    if (!resp.ok) {
      return redirect(`/admin/email-domain?err=resend&detail=${encodeURIComponent(resp.error)}`, 303);
    }

    const newStatus = mapResendStatus(resp.data.status);
    await admin
      .from('hotel_settings')
      .update({ custom_email_status: newStatus })
      .eq('hotel_id', hotel.id);

    return redirect(`/admin/email-domain?saved=verified&status=${encodeURIComponent(newStatus)}`, 303);
  }

  // ── REMOVE ──────────────────────────────────────────────────────────
  if (action === 'remove') {
    const { data: row } = await admin
      .from('hotel_settings')
      .select('resend_domain_id')
      .eq('hotel_id', hotel.id)
      .maybeSingle();

    if (row?.resend_domain_id) {
      const del = await resendDeleteDomain(row.resend_domain_id);
      if (!del.ok) {
        console.warn('[email-domain] Resend delete failed (continuing):', del.error);
      }
    }

    await admin
      .from('hotel_settings')
      .update({
        custom_email_domain: null,
        custom_email_status: null,
        resend_domain_id: null,
      })
      .eq('hotel_id', hotel.id);

    return redirect('/admin/email-domain?saved=removed', 303);
  }

  return redirect('/admin/email-domain?err=unknown_action', 303);
};

/** Mapped Resend-Status auf unsere enum-Werte (pending|verified|failed). */
function mapResendStatus(resendStatus: string | undefined): 'pending' | 'verified' | 'failed' {
  if (resendStatus === 'verified') return 'verified';
  if (resendStatus === 'failed' || resendStatus === 'temporary_failure') return 'failed';
  return 'pending';
}
