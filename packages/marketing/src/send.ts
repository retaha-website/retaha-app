// Sprint Wallet · Phase 10 — Bulk-Send-Logic für Marketing-Campaigns
//
// Lifecycle:
//   draft     → kann editiert werden
//   scheduled → scheduled_at gesetzt, Cron pickt auf
//   sending   → Lock-State während Run (atomarer Übergang via WHERE-Clause)
//   sent      → erfolgreich abgeschlossen, recipients_count gesetzt
//   cancelled → manuell abgebrochen (nur aus draft/scheduled erlaubt)
//   failed    → Run hat geknallt, send_error gefüllt
//
// Send-Algorithmus pro Campaign:
//   1. Atomarer Lock: UPDATE status='sending' WHERE status IN ('draft','scheduled')
//      → returnt 0 Zeilen wenn schon im Run (verhindert Doppel-Sends)
//   2. wallet_passes für hotel_id laden + Filter via target_filter
//   3. Pro Pass:
//        a. canSendPush(pass, 'marketing') → bei false: marketing_sends-Row
//           mit failed_reason=reason, kein Google-Call
//        b. bei true: pickI18n auf body_i18n/title_i18n via guest.language →
//           renderVariables (first_name, hotel_name, etc.) → addMessageToPass()
//        c. marketing_sends-Row mit sent_at, lang_used
//      Try/catch PRO PASS — Failure einer Sende killt nicht den Run
//   4. UPDATE campaign mit final-stats + status='sent' (oder 'failed' wenn alles down)
//
// Performance: sequentiell statt parallel. Google Wallet API hat
// pro-Issuer Rate-Limits, parallel würde 429en. 1 Pass ≈ 150-300ms, 1000
// Pässe ≈ 3-5 Min. Akzeptabel für MVP. Optimierung in Backlog.

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { canSendPush } from '@retaha/wallet';
import { addMessageToPass } from '@retaha/wallet';
import { renderVariables, type VariableContext } from '@retaha/wallet';
import { pickI18n } from '@retaha/i18n';
import { asLanguageCode } from '@retaha/i18n';
import { buildOptOutUrl } from '@retaha/wallet';
import { getEnv } from '@retaha/db';
import type { LanguageCode } from '@retaha/i18n';
import { buildMarketingEmailHtml } from './email-sender';
import { applyEmailOptInFilter } from './audience';
import { resolveMarketingEmailTransport } from './email-transport';

// Marketing-Campaign-Status — string literal types
type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface SendCampaignResult {
  ok: boolean;
  campaignId: string;
  status: CampaignStatus;
  recipients: number;
  skipped: number;
  skipReasons: Record<string, number>;
  failed: number;
  durationMs: number;
  message?: string;
}

interface TargetFilter {
  language?: string;             // exakter Match auf guest.language
  min_visit_count?: number;      // wallet_passes.visit_count >=
}

function matchesFilter(pass: any, filter: TargetFilter | null): boolean {
  if (!filter) return true;
  if (filter.min_visit_count != null && (pass.visit_count ?? 0) < filter.min_visit_count) return false;
  // Sprach-Filter prüfen wir gegen guest.language ODER pass.guest_first_name's stay-Verknüpfung;
  // ohne Stay-Join: skip wenn nicht bekannt. Marketing-Pässe haben keinen direkten lang-Slot —
  // wir nehmen den ersten Stay-Match als Hilfsbasis (Backlog: dedizierte pass.preferred_language)
  if (filter.language) {
    const passLang = pass._preferred_language;
    if (!passLang) return false;
    if (passLang !== filter.language) return false;
  }
  return true;
}

function buildVarContext(pass: any, hotelName: string, hotelLang: LanguageCode): VariableContext {
  const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };
  const fmt = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(localeMap[hotelLang] || 'de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  return {
    first_name: pass.guest_first_name || '',
    last_name: pass.guest_last_name || '',
    hotel_name: hotelName,
    visit_count: pass.visit_count ?? 1,
    last_visit_date: fmt(pass.last_visit_at),
    first_visit_date: fmt(pass.first_visit_at),
  };
}

/**
 * Strippt einfache HTML-Tags für die Push-Notification-Vorschau.
 * Google Wallet messages.body ist plain-text; HTML wäre sichtbarer Müll.
 */
function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Führt einen Bulk-Send für eine Campaign aus.
 *
 * Atomarer Lock via conditional UPDATE: wenn die Campaign nicht in
 * draft/scheduled ist (oder schon 'sending'), tut nichts und returnt
 * status_unchanged. So bleibt der Cron sicher gegen Concurrent-Triggers.
 */
export async function runCampaignSend(campaignId: string): Promise<SendCampaignResult> {
  const startedAt = Date.now();
  const sb = createSupabaseServiceRoleInstance();

  // ── 1. Campaign atomar locken ────────────────────────────────────────────
  const { data: lockedRows, error: lockErr } = await sb
    .from('marketing_campaigns')
    .update({ status: 'sending', send_started_at: new Date().toISOString() })
    .in('status', ['draft', 'scheduled'])
    .eq('id', campaignId)
    .select('id, hotel_id, title_i18n, body_i18n, push_title_i18n, push_body_i18n, cta_label_i18n, cta_url, target_filter, name, channels')
    .single();

  if (lockErr || !lockedRows) {
    return {
      ok: false, campaignId, status: 'failed',
      recipients: 0, skipped: 0, skipReasons: {}, failed: 0,
      durationMs: Date.now() - startedAt,
      message: lockErr?.message || 'campaign_not_lockable (möglicherweise schon im Run oder bereits gesendet)',
    };
  }

  const campaign = lockedRows;

  try {
    // ── 2. Hotel-Defaults laden ───────────────────────────────────────────
    const { data: hotel } = await sb
      .from('hotels')
      .select('id, name, default_language, enabled_languages')
      .eq('id', campaign.hotel_id)
      .single();
    const hotelDefault = asLanguageCode(hotel?.default_language);
    const hotelName = hotel?.name || 'Hotel';

    // ── 3. Wallet-Pässe laden ──────────────────────────────────────────────
    const { data: allPasses, error: passErr } = await sb
      .from('wallet_passes')
      .select('id, state, marketing_consent_given, guest_first_name, guest_last_name, guest_email, visit_count, first_visit_at, last_visit_at, google_object_id')
      .eq('hotel_id', campaign.hotel_id);
    if (passErr) throw new Error(`pass-load failed: ${passErr.message}`);

    const targetFilter = campaign.target_filter as TargetFilter | null;

    // Optional: Sprach-Filter braucht guest.language — laden falls Filter aktiv
    let passLangs = new Map<string, string>();
    if (targetFilter?.language) {
      // Join über stays.email = wallet_passes.guest_email + guests.language
      const { data: stayRows } = await sb
        .from('stays')
        .select('hotel_id, guests!inner(email, language)')
        .eq('hotel_id', campaign.hotel_id);
      for (const row of (stayRows as any[] ?? [])) {
        const g = Array.isArray(row.guests) ? row.guests[0] : row.guests;
        if (g?.email && g?.language) {
          if (!passLangs.has(g.email)) passLangs.set(g.email, g.language);
        }
      }
    }

    // ── 4. Eligibility + Skip-Tracking ─────────────────────────────────────
    const skipReasons: Record<string, number> = {};
    const eligible: any[] = [];
    const skipped: Array<{ pass: any; reason: string }> = [];

    for (const pass of (allPasses ?? [])) {
      // Target-Filter Pre-Check (gilt vor push-guard)
      const enriched = { ...pass, _preferred_language: passLangs.get(pass.guest_email) };
      if (!matchesFilter(enriched, targetFilter)) {
        const reason = 'filter_excluded';
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        skipped.push({ pass: enriched, reason });
        continue;
      }
      // DSGVO-Gate
      const r = canSendPush({
        state: pass.state as 'active' | 'opted_out' | 'expired',
        marketingConsentGiven: pass.marketing_consent_given,
        pushType: 'marketing',
      });
      if (!r.canSend) {
        skipReasons[r.reason] = (skipReasons[r.reason] || 0) + 1;
        skipped.push({ pass: enriched, reason: r.reason });
        continue;
      }
      // No google_object_id → Pass wurde nie an Google synced (Issuer-Approval
      // ausstehend zum Zeitpunkt des Wallet-Add). Skip mit klarem Reason.
      if (!pass.google_object_id) {
        const reason = 'pass_not_synced_to_google';
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        skipped.push({ pass: enriched, reason });
        continue;
      }
      eligible.push(enriched);
    }

    // ── 5. marketing_sends für Skips schreiben (Audit) ─────────────────────
    if (skipped.length > 0) {
      const rows = skipped.map(s => ({
        campaign_id: campaign.id,
        wallet_pass_id: s.pass.id,
        sent_at: null,
        delivered: false,
        failed_reason: s.reason,
        lang_used: null,
      }));
      // Chunked Insert um INSERT-Size-Limits zu vermeiden
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await sb.from('marketing_sends').upsert(chunk, { onConflict: 'campaign_id,wallet_pass_id' });
        if (error) console.warn('[campaign-send] skipped-insert chunk failed:', error.message);
      }
    }

    // ── 6. Eligible: Send (sequenziell wegen Google-Rate-Limits) ──────────
    // Phase 13: insert-first-then-wrap-then-send Pattern damit die CTA-URL
    // mit echter send_id getrackt werden kann. Schritte pro Pass:
    //   1. marketing_sends UPSERT (sent_at=null) → erhalten wir send_id
    //   2. CTA-URL wrappen mit send_id
    //   3. addMessageToPass mit gewrappter URL im body
    //   4. marketing_sends UPDATE (sent_at=NOW or failed_reason)
    let sentCount = 0;
    let failedCount = 0;
    const siteOrigin = getEnv('PUBLIC_SITE_URL') || 'https://demo.retaha.de';
    const campaignCtaUrl = (campaign as any).cta_url as string | null;

    for (const pass of eligible) {
      try {
        // Sprache wählen: pass language (falls bekannt) > hotel-default
        const passLang = asLanguageCode(passLangs.get(pass.guest_email) || hotelDefault);

        // Step 1: send-Row vorab anlegen (oder updaten wenn schon da)
        const { data: sendRow, error: insErr } = await sb
          .from('marketing_sends')
          .upsert({
            campaign_id: campaign.id,
            wallet_pass_id: pass.id,
            sent_at: null,
            delivered: null,
            lang_used: passLang.slice(0, 2),
            failed_reason: null,
          }, { onConflict: 'campaign_id,wallet_pass_id' })
          .select('id')
          .single();
        if (insErr || !sendRow) {
          failedCount++;
          console.warn(`[campaign-send] sends-row insert failed for pass ${pass.id.slice(0, 8)}:`, insErr?.message);
          continue;
        }
        const sendId = sendRow.id;

        // Step 2: CTA-URL wrappen wenn vorhanden
        const wrappedCta = campaignCtaUrl
          ? `${siteOrigin.replace(/\/$/, '')}/m/${sendId}?to=${encodeURIComponent(campaignCtaUrl)}`
          : null;

        // Step 3: Content rendern — Wallet-Push nutzt den separaten Push-Inhalt
        // (push_*_i18n); ist er NULL (Bestand / Drips / nicht ausgefüllt), fällt
        // es auf den E-Mail-Inhalt (title/body) zurück.
        const pushTitleI18n = (campaign as any).push_title_i18n ?? campaign.title_i18n;
        const pushBodyI18n = (campaign as any).push_body_i18n ?? campaign.body_i18n;
        const titleRaw = pickI18n(pushTitleI18n as any, hotelDefault, passLang);
        const bodyHtml = pickI18n(pushBodyI18n as any, hotelDefault, passLang);
        const ctaLabelRaw = pickI18n((campaign as any).cta_label_i18n, hotelDefault, passLang);
        const bodyPlain = htmlToPlain(bodyHtml);

        const ctx = buildVarContext(pass, hotelName, passLang);
        const optOutUrl = await buildOptOutUrl(pass.id, siteOrigin) || '';
        const renderedTitle = renderVariables(titleRaw, ctx);
        const renderedBody  = renderVariables(bodyPlain, ctx, { unsubscribe_link: optOutUrl });
        const renderedCtaLabel = renderVariables(ctaLabelRaw || '', ctx);

        // Step 3b: finalBody zusammensetzen — Body + optional CTA + optional Footer
        const parts: string[] = [renderedBody];
        if (wrappedCta) {
          parts.push(renderedCtaLabel ? `${renderedCtaLabel}: ${wrappedCta}` : wrappedCta);
        }
        if (optOutUrl) {
          parts.push(`— Abmelden: ${optOutUrl}`);
        }
        const finalBody = parts.filter(Boolean).join('\n\n');

        // Step 4: Send an Google Wallet
        const sendResult = await addMessageToPass({
          walletPassUuid: pass.id,
          hotelId: pass.hotel_id ?? campaign.hotel_id,
          header: renderedTitle,
          body: finalBody,
          messageId: `campaign-${campaign.id}-${pass.id}`,
        });

        // Step 5: marketing_sends UPDATE mit Endergebnis
        if (sendResult.ok) {
          sentCount++;
          await sb.from('marketing_sends').update({
            sent_at: new Date().toISOString(),
            delivered: null,  // Webhook setzt later
            failed_reason: null,
          }).eq('id', sendId);
        } else {
          failedCount++;
          if (sendResult.status === 'object_not_found') {
            await sb.from('wallet_passes').update({
              state: 'opted_out',
              opted_out_at: new Date().toISOString(),
              opted_out_reason: 'object_404_in_google_wallet',
            }).eq('id', pass.id);
          }
          await sb.from('marketing_sends').update({
            sent_at: null,
            delivered: false,
            failed_reason: sendResult.status + (sendResult.message ? `: ${sendResult.message.slice(0, 200)}` : ''),
          }).eq('id', sendId);
        }
      } catch (err) {
        failedCount++;
        console.warn(`[campaign-send] pass ${pass.id.slice(0, 8)} failed (non-fatal):`, (err as Error).message);
        await sb.from('marketing_sends').upsert({
          campaign_id: campaign.id,
          wallet_pass_id: pass.id,
          sent_at: null,
          delivered: false,
          failed_reason: 'uncaught_exception: ' + (err as Error).message.slice(0, 200),
        }, { onConflict: 'campaign_id,wallet_pass_id' });
      }
    }

    // ── 6b. Email-Kanal (wenn aktiviert) ──────────────────────────────────────────
    const channels = (campaign as any).channels as string[] ?? ['wallet_push'];
    if (channels.includes('email')) {
      // Hybrid-Routing: Provider pro Hotel auflösen (ACS-Standard ODER eigene
      // verifizierte Resend-Domain). KEIN stiller Fallback — „eigene Domain
      // gewählt, aber nicht verifiziert" blockiert den E-Mail-Kanal.
      const transport = await resolveMarketingEmailTransport(sb, campaign.hotel_id, hotelName);
      if (!transport.ok) {
        const reason = `email_blocked_${transport.reason}`;
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        console.warn(`[campaign-send ${campaignId.slice(0, 8)}] E-Mail-Kanal blockiert: ${transport.reason}`);
      } else {
        const emailSender = transport.sender;
        console.info(`[campaign-send ${campaignId.slice(0, 8)}] E-Mail-Provider=${transport.provider} from="${transport.from}"`);
        const backofficeUrl = (getEnv('PUBLIC_BACKOFFICE_URL') || 'https://backoffice.retaha.de').replace(/\/$/, '');

        // Bestätigte Abonnenten dieses Hotels laden. Opt-in-Filter = GETEILTE Wahrheit
        // (applyEmailOptInFilter aus ./audience) — exakt dieselbe Definition, die die
        // Backoffice-Kontaktliste /marketing/guests in der „Opt-in"-Ansicht nutzt.
        const { data: waitlistEntries } = await applyEmailOptInFilter(
          sb.from('marketing_waitlist')
            .select('id, email, confirmation_token')
            .eq('hotel_id', campaign.hotel_id)
        );

        // Email → Pass-Map für optionalen Gastname + Sprache (kein Pflicht-Match)
        const emailToPass = new Map<string, any>();
        for (const pass of allPasses ?? []) {
          if (pass.guest_email) emailToPass.set(pass.guest_email.toLowerCase(), pass);
        }

        const hotelTargets = waitlistEntries ?? [];

        for (const target of hotelTargets) {
          try {
            const pass = emailToPass.get(target.email.toLowerCase());
            const passLang = asLanguageCode(passLangs.get(target.email.toLowerCase()) || hotelDefault);

            // Doppelversand-Check: existiert bereits ein Email-Send für diese Kampagne+Waitlist-ID?
            const { data: existingRow } = await sb
              .from('marketing_sends')
              .select('id')
              .eq('campaign_id', campaign.id)
              .eq('waitlist_id', target.id)
              .eq('channel', 'email')
              .maybeSingle();
            if (existingRow) continue;

            // Send-Row vorab anlegen um ID für Tracking-Pixel zu erhalten
            const { data: sendRow, error: insErr } = await sb
              .from('marketing_sends')
              .insert({
                campaign_id: campaign.id,
                wallet_pass_id: null,
                waitlist_id: target.id,
                channel: 'email',
                sent_at: null,
                lang_used: passLang.slice(0, 2),
              })
              .select('id')
              .single();
            if (insErr || !sendRow) {
              console.warn('[campaign-send] email send-row insert failed:', insErr?.message);
              continue;
            }

            // Tracking-Pixel + Unsubscribe-URL
            const trackingPixelUrl = `${backofficeUrl}/api/marketing/track/open/${sendRow.id}`;
            const unsubscribeUrl = `${backofficeUrl}/api/marketing/consent/unsubscribe?token=${target.confirmation_token}`;
            const wrappedCta = campaignCtaUrl
              ? `${siteOrigin.replace(/\/$/, '')}/m/${sendRow.id}?to=${encodeURIComponent(campaignCtaUrl)}`
              : null;

            // Content rendern
            const titleRaw = pickI18n(campaign.title_i18n as any, hotelDefault, passLang);
            const bodyHtml = pickI18n(campaign.body_i18n as any, hotelDefault, passLang);
            const ctaLabelRaw = pickI18n((campaign as any).cta_label_i18n, hotelDefault, passLang);
            const ctx = buildVarContext(pass ?? { guest_first_name: '', guest_last_name: '', visit_count: 1, last_visit_at: null, first_visit_at: null }, hotelName, passLang);

            const html = buildMarketingEmailHtml({
              title: renderVariables(titleRaw, ctx),
              body: renderVariables(bodyHtml, ctx),
              ctaLabel: ctaLabelRaw ? renderVariables(ctaLabelRaw, ctx) : undefined,
              ctaUrl: wrappedCta ?? undefined,
              unsubscribeUrl,
              trackingPixelUrl,
              hotelName,
            });

            const emailResult = await emailSender.send({
              to: target.email,
              subject: renderVariables(titleRaw, ctx),
              html,
            });

            await sb.from('marketing_sends').update({
              sent_at: emailResult.ok ? new Date().toISOString() : null,
              delivered: emailResult.ok ? null : false,
              failed_reason: emailResult.ok ? null : emailResult.error?.slice(0, 200),
            }).eq('id', sendRow.id);

            if (emailResult.ok) sentCount++; else failedCount++;
          } catch (err) {
            failedCount++;
            console.warn('[campaign-send] email-send failed:', (err as Error).message);
          }
        }
      }
    }

    // ── 7. Campaign final-stats ───────────────────────────────────────────
    const durationMs = Date.now() - startedAt;
    const finalStatus: CampaignStatus = (sentCount > 0 || (eligible.length === 0 && (allPasses?.length ?? 0) > 0))
      ? 'sent'
      : 'failed';  // alle eligible failed UND es gab welche → status='failed'

    await sb.from('marketing_campaigns').update({
      status: finalStatus,
      sent_at: new Date().toISOString(),
      recipients_count: sentCount,
      skipped_count: skipped.length,
      skip_reasons: Object.keys(skipReasons).length > 0 ? skipReasons : null,
      send_error: (failedCount > 0 && sentCount === 0) ? `${failedCount} sends failed` : null,
    }).eq('id', campaignId);

    console.info(
      `[campaign-send ${campaignId.slice(0,8)}] "${campaign.name}" · ` +
      `sent=${sentCount} skipped=${skipped.length} failed=${failedCount} · ${durationMs}ms`
    );

    return {
      ok: true, campaignId, status: finalStatus,
      recipients: sentCount,
      skipped: skipped.length,
      skipReasons,
      failed: failedCount,
      durationMs,
    };
  } catch (err) {
    // Catch-all: setze status=failed damit Cron nicht in Endlos-Loop kommt
    const errMsg = (err as Error).message || 'unknown';
    console.error(`[campaign-send ${campaignId.slice(0,8)}] crashed:`, errMsg);
    await sb.from('marketing_campaigns').update({
      status: 'failed',
      send_error: errMsg.slice(0, 500),
    }).eq('id', campaignId);
    return {
      ok: false, campaignId, status: 'failed',
      recipients: 0, skipped: 0, skipReasons: {}, failed: 0,
      durationMs: Date.now() - startedAt,
      message: errMsg,
    };
  }
}
