/**
 * Login-Landing-Routing (RBAC).
 *
 * Nach erfolgreicher Auth entscheidet die Rolle das Ziel:
 *   owner/manager → Backoffice, staff → Dashboard.
 *
 * Selbst ein explizites return_to=backoffice wird für staff auf das Dashboard
 * umgebogen — sonst landet staff im Backoffice und prallt erst an der
 * BO-Middleware ab (unnötiger Bounce). return_to zu Dashboard oder Guest-App
 * bleibt unverändert (Dashboard ist für alle Rollen erlaubt, Guest-Seiten
 * self-guarden).
 *
 * Rollen-Lookup via RLS-self-read mit der frischen Session (accessToken).
 * Fail closed: keine/unbekannte Rolle → Dashboard (nie Backoffice).
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@retaha/db';
import { anyRoleCanAccessSurface, isRole } from '@retaha/auth';
import { sanitizeReturnTo } from './redirect-whitelist';

function dashboardLanding(): string {
  return getEnv('DASHBOARD_LANDING_TARGET') ?? 'https://dashboard.retaha.de';
}

async function fetchRoles(accessToken: string): Promise<string[]> {
  const url = getEnv('PUBLIC_SUPABASE_URL');
  const anon = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) return [];

  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await client.from('hotel_users').select('role');
  if (error || !data) return [];
  return data.map((r: { role: unknown }) => r.role).filter(isRole);
}

export async function resolveLanding(
  accessToken: string,
  returnTo: string | null | undefined,
): Promise<string> {
  const sanitized = sanitizeReturnTo(returnTo);

  let host = '';
  try { host = new URL(sanitized).hostname; } catch { return sanitized; }

  // Nur Backoffice-Ziele sind rollenabhängig; Dashboard/Guest bleiben.
  const targetsBackoffice = host === 'backoffice.retaha.de' || host.startsWith('backoffice.');
  if (!targetsBackoffice) return sanitized;

  const roles = await fetchRoles(accessToken);
  if (anyRoleCanAccessSurface(roles, 'backoffice')) return sanitized;

  return dashboardLanding();
}
