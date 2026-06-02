// Sprint E4 · Phase 7 — Confirm-Action Endpoint
//
// POST /api/eve/confirm-action — vom Frontend aufgerufen wenn Gast eine
// Eve-Action-Confirmation-Card mit "Bestätigen" akzeptiert.
//
// Stay-Context kommt aus dem Stay-Session-Cookie (Sprint D Phase 3). Body
// enthält das pending_action das Eve im vorherigen Tool-Use gebaut hat.

import type { APIRoute } from 'astro';
import { getStaySession } from '@retaha/auth';
import {
  executeConfirmedAction,
  type PendingAction,
  type EveExecutionContext,
} from '@retaha/eve';

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getStaySession(cookies);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized — no stay session' }, 401);
  }

  let body: { pending_action?: PendingAction; conversation_context?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const pending = body.pending_action;
  if (!pending || !pending.action_type || !pending.action_params) {
    return json({ ok: false, error: 'Missing pending_action with action_type + action_params' }, 400);
  }

  const ctx: EveExecutionContext = {
    hotel_id: session.hotel_id,
    stay_id: session.stay_id,
  };

  const result = await executeConfirmedAction(
    pending,
    ctx,
    body.conversation_context ?? '(no context provided)',
  );

  return json(result, result.ok ? 200 : 500);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
