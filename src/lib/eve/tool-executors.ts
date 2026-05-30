// Sprint E4 · Phase 7 — Tool-Executors für Eve
//
// Lookup-Tools: führen DB-Queries aus, liefern Daten an Eve zurück.
// Action-Tools: bauen NUR ein pending_action-Preview-Objekt. Die echte
// Ausführung passiert erst nach Gast-Confirmation via /api/eve/confirm-action.
//
// Stay-Context (hotel_id, stay_id) kommt aus EveExecutionContext (Stay-Session-
// Cookie-Lookup) — NIE aus Tool-Input. Sicherheits-Garantie.

import { createSupabaseServiceRoleInstance } from '../auth';
import { isLookupTool, isActionTool } from './tools';

const sb = () => createSupabaseServiceRoleInstance();

export interface EveExecutionContext {
  hotel_id: string;
  /** NULL wenn anonymer Visitor ohne Stay-Session. Action-Tools werfen dann error. */
  stay_id: string | null;
}

export interface ToolExecutionResult {
  /** Daten die Eve im next-turn als tool_result zurückbekommt. */
  data: unknown;
  /** Wenn Action-Tool: pending_action mit allen Infos für die Confirmation-Card. */
  pendingAction?: PendingAction;
}

export interface PendingAction {
  action_type: 'create_breakfast_booking' | 'request_service' | 'request_conference_room' | 'cancel_booking';
  action_params: Record<string, any>;
  /** Lesbare Zusammenfassung für die Confirmation-Card im Frontend. */
  summary: {
    title: string;
    items?: Array<{ label: string; price_cents?: number; quantity?: number }>;
    when?: string;
    total_cents?: number;
    note?: string;
  };
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  ctx: EveExecutionContext,
): Promise<ToolExecutionResult> {
  if (isLookupTool(toolName)) {
    switch (toolName) {
      case 'get_stay_details':     return { data: await getStayDetails(ctx) };
      case 'get_breakfast_menu':   return { data: await getBreakfastMenu(ctx) };
      case 'get_recommendations':  return { data: await getRecommendations(ctx, toolInput.category) };
      case 'get_active_bookings':  return { data: await getActiveBookings(ctx) };
      case 'get_conference_rooms': return { data: await getConferenceRooms(ctx) };
      case 'get_hotel_info':       return { data: await getHotelInfo(ctx) };
    }
  }

  if (isActionTool(toolName)) {
    if (!ctx.stay_id) {
      return {
        data: { error: 'Anonyme Visitor ohne Stay-Session können keine Buchungen anfordern. Bitte zuerst einloggen.' },
      };
    }
    switch (toolName) {
      case 'create_breakfast_booking':  return buildCreateBreakfastPending(toolInput);
      case 'request_service':           return buildRequestServicePending(toolInput);
      case 'request_conference_room':   return buildRequestConferencePending(toolInput);
      case 'cancel_booking':            return await buildCancelBookingPending(toolInput, ctx);
    }
  }

  return { data: { error: `Unknown tool: ${toolName}` } };
}

// ============================================================
// LOOKUP-Executors
// ============================================================

async function getStayDetails(ctx: EveExecutionContext) {
  if (!ctx.stay_id) {
    return { error: 'Kein aktiver Stay — Gast ist anonymer Visitor.' };
  }
  const { data } = await sb()
    .from('stays')
    .select(`
      id, check_in, check_out, guest_count,
      guests(first_name, last_name),
      rooms(room_number, room_name)
    `)
    .eq('id', ctx.stay_id)
    .maybeSingle();
  if (!data) return { error: 'Stay nicht gefunden.' };
  const g = data.guests as any;
  const r = data.rooms as any;
  return {
    guest_name: [g?.first_name, g?.last_name].filter(Boolean).join(' ') || null,
    room: r?.room_number ? `${r.room_number}${r.room_name ? ` (${r.room_name})` : ''}` : (r?.room_name ?? null),
    check_in: data.check_in?.slice(0, 10),
    check_out: data.check_out?.slice(0, 10),
    guest_count: data.guest_count,
  };
}

async function getBreakfastMenu(ctx: EveExecutionContext) {
  const { data } = await sb()
    .from('breakfast_items')
    .select(`
      id, name_de, name_en, description_de, description_en,
      price_cents, category,
      is_vegan, is_vegetarian, is_organic,
      contains_gluten, contains_milk, contains_eggs, contains_nuts, contains_soy
    `)
    .eq('hotel_id', ctx.hotel_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return {
    items: (data ?? []).map(item => ({
      id: item.id,
      name: item.name_de,
      name_en: item.name_en,
      description: item.description_de,
      price_eur: item.price_cents != null ? (item.price_cents / 100) : null,
      category: item.category,
      diet: {
        vegan: item.is_vegan,
        vegetarian: item.is_vegetarian,
        organic: item.is_organic,
      },
      allergens: Object.entries({
        gluten: item.contains_gluten,
        milk: item.contains_milk,
        eggs: item.contains_eggs,
        nuts: item.contains_nuts,
        soy: item.contains_soy,
      }).filter(([_, v]) => v === true).map(([k]) => k),
    })),
  };
}

async function getRecommendations(ctx: EveExecutionContext, category?: string) {
  const { data } = await sb()
    .from('hotel_settings')
    .select('recommendations')
    .eq('hotel_id', ctx.hotel_id)
    .maybeSingle();
  let recs = (data?.recommendations as any[]) ?? [];
  if (category && category !== 'all') {
    recs = recs.filter(r => (r.category ?? '').toLowerCase() === category.toLowerCase());
  }
  return { recommendations: recs };
}

async function getActiveBookings(ctx: EveExecutionContext) {
  if (!ctx.stay_id) {
    return { error: 'Kein aktiver Stay — Buchungen sind stay-spezifisch.' };
  }
  const { data } = await sb()
    .from('bookings')
    .select('id, type, status, details, created_at')
    .eq('stay_id', ctx.stay_id)
    .order('created_at', { ascending: false });
  return {
    bookings: (data ?? []).map(b => ({
      id: b.id,
      type: b.type,
      status: b.status,
      details: b.details,
      created_at: b.created_at,
    })),
  };
}

async function getConferenceRooms(ctx: EveExecutionContext) {
  const { data } = await sb()
    .from('hotel_settings')
    .select('conference_rooms, conference_start_time, conference_end_time, conference_slot_minutes')
    .eq('hotel_id', ctx.hotel_id)
    .maybeSingle();
  const rooms = (data?.conference_rooms as any[]) ?? [];
  return {
    rooms,
    booking_window: {
      start: data?.conference_start_time,
      end: data?.conference_end_time,
      slot_minutes: data?.conference_slot_minutes,
    },
  };
}

async function getHotelInfo(ctx: EveExecutionContext) {
  const { data: hotel } = await sb()
    .from('hotels')
    .select('id, name, city, country')
    .eq('id', ctx.hotel_id)
    .maybeSingle();
  const { data: s } = await sb()
    .from('hotel_settings')
    .select(`
      wifi_ssid, wifi_password, wifi_speed_mbits,
      breakfast_start_time, breakfast_end_time, breakfast_location_de,
      conference_start_time, conference_end_time
    `)
    .eq('hotel_id', ctx.hotel_id)
    .maybeSingle();
  return {
    name: hotel?.name,
    city: hotel?.city,
    country: hotel?.country,
    wifi: s?.wifi_ssid ? { ssid: s.wifi_ssid, password: s.wifi_password, speed_mbits: s.wifi_speed_mbits } : null,
    breakfast: s?.breakfast_start_time ? {
      start: s.breakfast_start_time,
      end: s.breakfast_end_time,
      location: s.breakfast_location_de,
    } : null,
    conference: s?.conference_start_time ? { start: s.conference_start_time, end: s.conference_end_time } : null,
  };
}

// ============================================================
// ACTION-Executors (return pending_action — NICHT ausführen!)
// ============================================================

function buildCreateBreakfastPending(input: any): ToolExecutionResult {
  const items = (input.items ?? []) as Array<{ breakfast_item_id: string; name: string; quantity?: number; price_cents?: number }>;
  const totalCents = items.reduce((sum, it) => sum + ((it.price_cents ?? 0) * (it.quantity ?? 1)), 0);
  const when = `${input.date}${input.time_slot ? ` · ${input.time_slot}` : ''}`;

  const pendingAction: PendingAction = {
    action_type: 'create_breakfast_booking',
    action_params: {
      items: items.map(it => ({ breakfast_item_id: it.breakfast_item_id, quantity: it.quantity ?? 1 })),
      date: input.date,
      time_slot: input.time_slot,
      people: input.people ?? 1,
      table_preference: input.table_preference,
    },
    summary: {
      title: 'Frühstück buchen?',
      items: items.map(it => ({ label: it.name, price_cents: it.price_cents, quantity: it.quantity })),
      when,
      total_cents: totalCents,
      note: totalCents > 0 ? 'wird auf Zimmer gebucht' : 'inkludiert',
    },
  };

  return {
    data: {
      pending_confirmation: true,
      preview: pendingAction.summary,
      message_to_guest: 'Diese Buchung wird erstellt sobald du "Bestätigen" klickst.',
    },
    pendingAction,
  };
}

function buildRequestServicePending(input: any): ToolExecutionResult {
  const pendingAction: PendingAction = {
    action_type: 'request_service',
    action_params: {
      service_type: input.service_type,
      item_name: input.item_name,
      details: input.details ?? null,
      date: input.date ?? null,
      time: input.time ?? null,
    },
    summary: {
      title: `Service anfragen: ${input.item_name}`,
      when: [input.date, input.time].filter(Boolean).join(' · ') || null,
      note: input.details ?? undefined,
    },
  };
  return {
    data: { pending_confirmation: true, preview: pendingAction.summary, message_to_guest: 'Service-Anfrage wartet auf deine Bestätigung.' },
    pendingAction,
  };
}

function buildRequestConferencePending(input: any): ToolExecutionResult {
  const duration = input.duration_hours ?? estimateHours(input.time_start, input.time_end);
  const pendingAction: PendingAction = {
    action_type: 'request_conference_room',
    action_params: {
      room_id: input.room_id,
      room_name: input.room_name,
      date: input.date,
      time_start: input.time_start,
      time_end: input.time_end,
      duration_hours: duration,
      people: input.people ?? 1,
    },
    summary: {
      title: `Konferenz-Raum buchen: ${input.room_name}`,
      when: `${input.date} · ${input.time_start}–${input.time_end} (${duration}h)`,
      note: input.people ? `${input.people} Personen` : undefined,
    },
  };
  return {
    data: { pending_confirmation: true, preview: pendingAction.summary, message_to_guest: 'Raum-Buchung wartet auf Bestätigung.' },
    pendingAction,
  };
}

async function buildCancelBookingPending(input: any, ctx: EveExecutionContext): Promise<ToolExecutionResult> {
  // Sicherheits-Check: gehört das Booking zum aktuellen Stay?
  const { data: booking } = await sb()
    .from('bookings')
    .select('id, type, status, stay_id')
    .eq('id', input.booking_id)
    .maybeSingle();

  if (!booking) {
    return { data: { error: 'Buchung nicht gefunden.' } };
  }
  if (booking.stay_id !== ctx.stay_id) {
    return { data: { error: 'Diese Buchung gehört nicht zu deinem aktuellen Aufenthalt.' } };
  }
  if (booking.status === 'cancelled') {
    return { data: { error: 'Diese Buchung ist bereits storniert.' } };
  }

  const pendingAction: PendingAction = {
    action_type: 'cancel_booking',
    action_params: {
      booking_id: input.booking_id,
      reason: input.reason ?? null,
    },
    summary: {
      title: `Buchung stornieren?`,
      note: `${input.booking_label}${input.reason ? ` — Grund: ${input.reason}` : ''}`,
    },
  };
  return {
    data: { pending_confirmation: true, preview: pendingAction.summary, message_to_guest: 'Stornierung wartet auf Bestätigung.' },
    pendingAction,
  };
}

function estimateHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const minutes = (eH * 60 + eM) - (sH * 60 + sM);
  return Math.max(0, Math.round((minutes / 60) * 10) / 10);
}

// ============================================================
// Confirm-Action: vom Endpoint aufgerufen wenn Gast "Bestätigen" klickt
// ============================================================

export interface ConfirmActionResult {
  ok: boolean;
  booking_id?: string;
  error?: string;
}

/**
 * Führt die zuvor vorbereitete Action aus + schreibt Audit-Log.
 * Wird von /api/eve/confirm-action aufgerufen, NICHT vom Eve-Tool-Call.
 */
export async function executeConfirmedAction(
  pending: PendingAction,
  ctx: EveExecutionContext,
  conversationContext: string,
): Promise<ConfirmActionResult> {
  if (!ctx.stay_id) {
    return { ok: false, error: 'Kein aktiver Stay.' };
  }

  const supabase = sb();
  let result: ConfirmActionResult;
  let bookingDetails: Record<string, any> = {};

  try {
    if (pending.action_type === 'create_breakfast_booking') {
      bookingDetails = pending.action_params;
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          hotel_id: ctx.hotel_id,
          stay_id: ctx.stay_id,
          type: 'breakfast',
          status: 'pending',
          details: bookingDetails,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      result = { ok: true, booking_id: data!.id };
    }

    else if (pending.action_type === 'request_service') {
      bookingDetails = pending.action_params;
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          hotel_id: ctx.hotel_id,
          stay_id: ctx.stay_id,
          type: 'service',
          status: 'pending',
          details: bookingDetails,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      result = { ok: true, booking_id: data!.id };
    }

    else if (pending.action_type === 'request_conference_room') {
      bookingDetails = pending.action_params;
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          hotel_id: ctx.hotel_id,
          stay_id: ctx.stay_id,
          type: 'conference',
          status: 'pending',
          details: bookingDetails,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      result = { ok: true, booking_id: data!.id };
    }

    else if (pending.action_type === 'cancel_booking') {
      const bookingId = pending.action_params.booking_id;
      bookingDetails = { booking_id: bookingId, reason: pending.action_params.reason };
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('stay_id', ctx.stay_id);
      if (error) throw new Error(error.message);
      result = { ok: true, booking_id: bookingId };
    }

    else {
      result = { ok: false, error: `Unbekannte Action: ${(pending as any).action_type}` };
    }

    // Audit-Log
    await supabase.from('eve_action_log').insert({
      hotel_id: ctx.hotel_id,
      stay_id: ctx.stay_id,
      action_type: pending.action_type,
      action_params: pending.action_params,
      conversation_context: conversationContext.slice(0, 4000),
      result: result.ok ? 'success' : 'failed',
      result_data: result.ok ? { booking_id: result.booking_id } : { error: result.error },
    });

    return result;
  } catch (err) {
    const errorMessage = (err as Error).message ?? String(err);
    await supabase.from('eve_action_log').insert({
      hotel_id: ctx.hotel_id,
      stay_id: ctx.stay_id,
      action_type: pending.action_type,
      action_params: pending.action_params,
      conversation_context: conversationContext.slice(0, 4000),
      result: 'failed',
      result_data: { error: errorMessage },
    });
    return { ok: false, error: errorMessage };
  }
}
