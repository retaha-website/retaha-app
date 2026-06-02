// Sprint D · Phase 4 — Aufenthalt-Starten-Endpoint
//
// Form-POST von /g/r/[room_code] "Aufenthalt starten →" landet hier.
// Erfolg → Cookie gesetzt → Redirect zurück zu /g/r/[room_code] → die Page
// löst jetzt via Cookie auf den Stay auf und redirect zu /g/[access_token]
// (Phase-3-Pragmatik) → Gast sieht Voll-Ansicht.
//
// Fehler → Redirect zurück zu /g/r/[room_code] → die Page rendert die
// passende Inline-Message (kein Stay / Karte nicht aktiv).

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { setStaySessionCookie } from '@retaha/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Body kann Form-Data ODER JSON sein
  let roomCode: string | null = null;
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const json = await request.json();
      roomCode = typeof json.room_code === 'string' ? json.room_code.trim() : null;
    } else {
      const form = await request.formData();
      roomCode = form.get('room_code')?.toString().trim() ?? null;
    }
  } catch {
    roomCode = null;
  }

  if (!roomCode) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_room_code' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createSupabaseServiceRoleInstance();

  // 1) room_code → Zimmer
  const { data: room } = await supabase
    .from('rooms')
    .select('id, hotel_id, is_active')
    .eq('room_code', roomCode)
    .maybeSingle();

  if (!room || room.is_active === false) {
    return redirect(`/g/r/${roomCode}`, 303);
  }

  // 2) Aktueller Stay im Zimmer — Brief: "Mehrere Stays gleichzeitig (Familie?)
  //    → ersten nehmen, oder Auswahl-UI (Backlog)". Wir nehmen den frühesten
  //    aktiven (check_in ASC) — bei Familien ist das deterministisch.
  //
  // Defensiv: zusätzlicher hotel_id-Filter. Bei Demo-Daten-Korruption (mehrere
  // Mews-Hotels mit denselben room_ids) verhindert das, dass wir einen Stay
  // aus einem anderen Hotel pairen — die Page würde sonst Cookie+Hotel-Mismatch
  // bemerken und ihn sofort wieder löschen.
  const { data: stay } = await supabase
    .from('stays')
    .select('id, hotel_id, check_out, state, is_active')
    .eq('room_id', room.id)
    .eq('hotel_id', room.hotel_id)
    .eq('is_active', true)
    .in('state', ['Confirmed', 'Started'])
    .order('check_in', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!stay) {
    // Kein aktiver Stay → Page rendert "Bitte zur Rezeption"
    return redirect(`/g/r/${roomCode}`, 303);
  }

  // 3) Cookie setzen (best-effort — bei fehlendem Secret false, dann logout-Pfad)
  const ok = await setStaySessionCookie(cookies, {
    stay_id: stay.id,
    hotel_id: stay.hotel_id,
    check_out_utc: stay.check_out,
  });

  if (!ok) {
    console.warn('[start-stay] setStaySessionCookie failed (STAY_SESSION_SECRET fehlt?)');
    // Trotzdem zurück zur Page — Inline-HTML wird die Karte als "OK aber kein Cookie" zeigen
    return redirect(`/g/r/${roomCode}`, 303);
  }

  // Audit: minimaler Console-Log, Tabelle ist Backlog (Brief: optional).
  // Falls später nötig: stay_session_events(stay_id, room_code, user_agent, ip, created_at).
  console.info('[start-stay] paired', { stay_id: stay.id, room_code: roomCode });

  // 303 See Other: erzwingt GET beim Redirect (Browser folgt mit neuem Cookie)
  return redirect(`/g/r/${roomCode}`, 303);
};
