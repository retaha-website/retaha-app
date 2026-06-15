import { getEnv } from '@retaha/db';

const RESEND_DOMAINS_API = 'https://api.resend.com/domains';

export interface ResendDomainRecord {
  record: string;
  name: string;
  type: string;
  ttl?: string | number;
  status?: string;
  value: string;
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;
  records?: ResendDomainRecord[];
  region?: string;
  created_at?: string;
}

export async function resendAddDomain(domain: string): Promise<{ ok: true; data: ResendDomain } | { ok: false; error: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey) return { ok: false, error: 'no_api_key' };
  try {
    const res = await fetch(RESEND_DOMAINS_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: domain }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
    return { ok: true, data: JSON.parse(text) as ResendDomain };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function resendGetDomain(domainId: string): Promise<{ ok: true; data: ResendDomain } | { ok: false; error: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey) return { ok: false, error: 'no_api_key' };
  try {
    const res = await fetch(`${RESEND_DOMAINS_API}/${encodeURIComponent(domainId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
    return { ok: true, data: JSON.parse(text) as ResendDomain };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function resendVerifyDomain(domainId: string): Promise<{ ok: true; data: ResendDomain } | { ok: false; error: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey) return { ok: false, error: 'no_api_key' };
  try {
    const res = await fetch(`${RESEND_DOMAINS_API}/${encodeURIComponent(domainId)}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
    const after = await resendGetDomain(domainId);
    if (!after.ok) return { ok: true, data: JSON.parse(text) as ResendDomain };
    return after;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function resendDeleteDomain(domainId: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey) return { ok: false, error: 'no_api_key' };
  try {
    const res = await fetch(`${RESEND_DOMAINS_API}/${encodeURIComponent(domainId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
