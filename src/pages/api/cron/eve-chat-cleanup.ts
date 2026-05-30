// Sprint E4 · Phase 11 — Cron Eve-Chat-Cleanup
//
// Vercel-Cron-Schedule (vercel.json): "0 3 * * *" — täglich 03:00 UTC.
// Ruft die RPC cleanup_eve_chat_messages() auf die alle chat_messages für
// abgeschlossene Stays (state IN Processed/Canceled, check_out > 1 Tag in
// der Vergangenheit) löscht.
//
// Auth wie andere Crons (Phase 5+6 von Sprint E1): Bearer ${CRON_SECRET}.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { getEnv } from '../../../lib/env';

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/eve-cleanup] CRON_SECRET nicht konfiguriert — Endpoint inaktiv');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }

  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const startedAt = new Date().toISOString();
  const sb = createSupabaseServiceRoleInstance();

  const { data, error } = await sb.rpc('cleanup_eve_chat_messages');
  if (error) {
    console.error('[cron/eve-cleanup] RPC failed:', error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  const deletedCount = typeof data === 'number' ? data : 0;
  const finishedAt = new Date().toISOString();
  console.info(`[cron/eve-cleanup] run ${startedAt} → ${finishedAt}: deleted=${deletedCount}`);

  return json({ ok: true, started_at: startedAt, finished_at: finishedAt, deleted_count: deletedCount }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
