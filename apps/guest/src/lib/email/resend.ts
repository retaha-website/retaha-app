// Sprint D · Phase 7 — Resend-Wrapper für Customer-Facing-Mails
//
// Direct fetch zu api.resend.com (keine SDK-Dependency, analog
// microsoft-smtp.ts). Gleiche Signatur wie der Microsoft-Wrapper —
// router.ts entscheidet welcher Provider pro Email-Type aufgerufen wird.
//
// Best-Effort: bei Fehler console.warn + return { ok: false }, niemals throw.

import { getEnv } from '@retaha/db';

export interface SendResendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  /** Vollständige From-Adresse inkl. Display-Name z.B. "Gate Garden Hotel <welcome@gategardenhotel.de>" */
  from: string;
  replyTo?: string;
}

export interface SendResendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const RESEND_API = 'https://api.resend.com/emails';

export async function sendResendEmail(params: SendResendEmailParams): Promise<SendResendEmailResult> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('[email/resend] RESEND_API_KEY fehlt — Customer-Facing-Email skipped:', params.subject);
    return { ok: false, error: 'no_api_key' };
  }

  const body = {
    from: params.from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
  };

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`[email/resend] HTTP ${res.status}:`, text.slice(0, 200));
      return { ok: false, error: `resend_${res.status}: ${text.slice(0, 200)}` };
    }
    const json = JSON.parse(text) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    console.warn('[email/resend] fetch failed:', (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}
