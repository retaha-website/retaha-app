// Sprint E4 · Phase 7 — Tool-Use Test
//
// Run via: npm run test:eve-tools
//
// 3 Scenarios:
//   A. Lookup-Tool: "Was kostet Frühstück morgen?"
//      → Erwartung: Eve ruft get_breakfast_menu auf
//      → Wir führen Tool aus + senden Result zurück + Eve antwortet final
//
//   B. Action-Tool: "Buch mir Granola mit Beeren für morgen 8:30"
//      → Erwartung: Eve ruft create_breakfast_booking mit pending_action zurück
//      → Wir prüfen: keine Buchung in DB, aber pending_action structure korrekt
//
//   C. Confirm-Action: führt pending_action aus Scenario B aus
//      → Eintrag in bookings (status=pending)
//      → Eintrag in eve_action_log (result=success)

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { EVE_TOOLS } from '../src/lib/eve/tools';
import { executeTool, executeConfirmedAction, type EveExecutionContext } from '../src/lib/eve/tool-executors';
import { buildSystemPrompt, type EveContext } from '../src/lib/eve/system-prompt';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

function divider(t: string) {
  console.log('');
  console.log('═'.repeat(78));
  console.log(' ' + t);
  console.log('═'.repeat(78));
}

async function loadEveContext(stayId: string): Promise<{ systemPrompt: string; ctx: EveExecutionContext }> {
  const { data: hotel } = await sb.from('hotels').select('id, name, city, country').eq('id', DEMO_HOTEL_ID).single();
  const { data: settings } = await sb.from('hotel_settings').select(`
    eve_name, eve_tonality, eve_custom_persona, eve_tuning_rules,
    guest_address_form,
    wifi_ssid, wifi_password, wifi_speed_mbits,
    breakfast_start_time, breakfast_end_time,
    breakfast_location_de, breakfast_location_en, breakfast_location_fr, breakfast_location_es,
    conference_rooms, conference_start_time, conference_end_time
  `).eq('hotel_id', DEMO_HOTEL_ID).single();
  const { data: knowledge } = await sb.from('eve_knowledge')
    .select('category, question, answer')
    .eq('hotel_id', DEMO_HOTEL_ID).eq('language_code', 'de').eq('is_published', true);
  const { data: stay } = await sb.from('stays')
    .select('id, check_in, check_out, raw_mews_data, guests(first_name, last_name, language), rooms(room_number, room_name)')
    .eq('id', stayId).single();

  const eveCtx: EveContext = {
    hotel: hotel as any,
    hotelSettings: settings as any,
    stay: stay ? {
      id: stay.id, check_in: stay.check_in, check_out: stay.check_out,
      raw_mews_data: stay.raw_mews_data,
    } : null,
    guest: (stay?.guests as any) ?? null,
    room: (stay?.rooms as any) ?? null,
    knowledge: (knowledge ?? []) as any,
    language: 'de',
  };

  return {
    systemPrompt: buildSystemPrompt(eveCtx),
    ctx: { hotel_id: DEMO_HOTEL_ID, stay_id: stayId },
  };
}

async function callEve(
  systemPrompt: string,
  userMessage: string,
  priorMessages: Anthropic.MessageParam[] = [],
): Promise<Anthropic.Message> {
  return anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    tools: EVE_TOOLS,
    messages: [...priorMessages, { role: 'user', content: userMessage }],
  });
}

function describeBlocks(content: Anthropic.ContentBlock[]) {
  for (const block of content) {
    if (block.type === 'text') {
      console.log('  [text]:', block.text.slice(0, 200) + (block.text.length > 200 ? '...' : ''));
    } else if (block.type === 'tool_use') {
      console.log('  [tool_use]:', block.name);
      console.log('    input:', JSON.stringify(block.input, null, 2).split('\n').map(l => '    ' + l).join('\n').trim());
    }
  }
}

async function main() {
  // Bestätigten Stay mit Vornamen finden für realistischen Test
  const { data: stay } = await sb.from('stays')
    .select('id, check_in, check_out, guests(first_name)')
    .eq('hotel_id', DEMO_HOTEL_ID).eq('is_active', true)
    .in('state', ['Confirmed', 'Started']).limit(1).single();
  if (!stay) { console.error('Kein aktiver Stay im Demo-Hotel'); process.exit(1); }
  console.log(`Test-Stay: ${stay.id} · Gast: ${(stay.guests as any)?.first_name ?? '(no name)'}`);

  const { systemPrompt, ctx } = await loadEveContext(stay.id);

  // ─── Scenario A: Lookup-Tool ─────────────────────────────────
  divider('A. Lookup-Tool — "Was kostet Frühstück morgen?"');
  const respA = await callEve(systemPrompt, 'Was kostet Frühstück bei euch? Ich überlege ob ich morgen welches buche.');
  console.log('Stop-Reason:', respA.stop_reason);
  describeBlocks(respA.content);

  const toolUseA = respA.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUseA) {
    console.log('⚠ Kein Tool-Call — Eve antwortete direkt');
  } else {
    console.log('\n→ Tool-Call:', toolUseA.name, 'wird jetzt ausgeführt...');
    const toolResultA = await executeTool(toolUseA.name, toolUseA.input as any, ctx);
    console.log('→ Tool-Result (truncated):', JSON.stringify(toolResultA.data).slice(0, 300) + '...');

    // Final-Turn: Eve antwortet mit Knowledge
    const finalA = await callEve(systemPrompt, '', [
      { role: 'user', content: 'Was kostet Frühstück bei euch? Ich überlege ob ich morgen welches buche.' },
      { role: 'assistant', content: respA.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseA.id, content: JSON.stringify(toolResultA.data) }] },
    ]);
    console.log('\n→ Eve-Final-Antwort:');
    describeBlocks(finalA.content);
  }

  // ─── Scenario B: Action-Tool → pending_action (Multi-Turn) ──
  divider('B. Action-Tool — "Buch mir Granola mit Beeren für morgen 8:30" (Multi-Turn)');
  const userMsgB = 'Bitte buch mir das Granola mit Beeren für morgen früh um 8:30, danke.';
  const messagesB: Anthropic.MessageParam[] = [{ role: 'user', content: userMsgB }];

  let pendingFromB = null;
  let respB: Anthropic.Message | null = null;

  // Loop: führe Lookups aus bis Eve entweder ein Action-Tool ruft oder text returnt
  for (let turn = 0; turn < 4; turn++) {
    respB = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: EVE_TOOLS,
      messages: messagesB,
    });
    console.log(`\n— Turn ${turn + 1} — Stop: ${respB.stop_reason}`);
    describeBlocks(respB.content);

    const toolUse = respB.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      console.log('  (kein Tool-Call — Eve hat geantwortet)');
      break;
    }

    const toolResult = await executeTool(toolUse.name, toolUse.input as any, ctx);

    if (toolResult.pendingAction) {
      console.log('✓ pending_action gebaut (Action-Tool):');
      console.log('   action_type:', toolResult.pendingAction.action_type);
      console.log('   summary:', JSON.stringify(toolResult.pendingAction.summary, null, 2));
      pendingFromB = toolResult.pendingAction;
      break;  // Action-Tool erreicht, wir stoppen
    }

    // Lookup-Tool: Result feeden + nächsten Turn
    console.log('  → Lookup-Result feeden, nächster Turn...');
    messagesB.push({ role: 'assistant', content: respB.content });
    messagesB.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult.data) }],
    });
  }

  if (!pendingFromB && respB) {
    // Eve fragte vermutlich nach Bestätigung — wir simulieren das User-"Ja, bitte"
    console.log('\n→ Eve wartet auf User-Bestätigung. Simuliere "Ja, bitte buch das"...');
    messagesB.push({ role: 'assistant', content: respB.content });
    messagesB.push({ role: 'user', content: 'Ja, bitte buch das so.' });

    for (let turn = 0; turn < 2; turn++) {
      respB = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: EVE_TOOLS,
        messages: messagesB,
      });
      console.log(`\n— Confirm-Turn ${turn + 1} — Stop: ${respB.stop_reason}`);
      describeBlocks(respB.content);

      const toolUse = respB.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (!toolUse) break;

      const toolResult = await executeTool(toolUse.name, toolUse.input as any, ctx);
      if (toolResult.pendingAction) {
        console.log('✓ pending_action gebaut nach Bestätigung:');
        console.log('   summary:', JSON.stringify(toolResult.pendingAction.summary, null, 2));
        pendingFromB = toolResult.pendingAction;
        break;
      }

      messagesB.push({ role: 'assistant', content: respB.content });
      messagesB.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult.data) }] });
    }
  }

  // Verify: KEINE Buchung in DB (Action ist pending, nicht executed)
  const { data: maybeBooking } = await sb.from('bookings')
    .select('id').eq('stay_id', stay.id).eq('type', 'breakfast')
    .order('created_at', { ascending: false }).limit(1);
  console.log(`\n  DB-Check vor Confirm: letzte breakfast-Buchung in Stay = ${maybeBooking?.[0]?.id ?? '(keine)'}`);

  // ─── Scenario C: Confirm-Action ──────────────────────────────
  if (pendingFromB) {
    divider('C. Confirm-Action — Gast klickt "Bestätigen"');
    const confirmResult = await executeConfirmedAction(
      pendingFromB,
      ctx,
      'User: "Bitte buch mir das Granola..."\nEve: "Soll ich für dich..."\nUser: "Ja"',
    );
    console.log('Confirm-Result:', JSON.stringify(confirmResult, null, 2));

    // Verify: Booking in DB + Audit-Log
    if (confirmResult.ok && confirmResult.booking_id) {
      const { data: newBooking } = await sb.from('bookings')
        .select('id, type, status, details').eq('id', confirmResult.booking_id).single();
      console.log('\n→ Booking in DB:');
      console.log('   id:', newBooking?.id);
      console.log('   type:', newBooking?.type, '| status:', newBooking?.status);
      console.log('   details:', JSON.stringify(newBooking?.details));

      const { data: auditLog } = await sb.from('eve_action_log')
        .select('id, action_type, result, result_data')
        .eq('stay_id', stay.id).order('created_at', { ascending: false }).limit(1).single();
      console.log('\n→ Audit-Log:');
      console.log('   id:', auditLog?.id);
      console.log('   action_type:', auditLog?.action_type);
      console.log('   result:', auditLog?.result);
      console.log('   result_data:', JSON.stringify(auditLog?.result_data));

      console.log('\n✓ End-to-End: Eve → pending → User-Confirm → bookings + eve_action_log');
    } else {
      console.log('⚠ Confirm fehlgeschlagen:', confirmResult.error);
    }
  } else {
    divider('C. SKIPPED — kein pendingAction aus Scenario B');
  }
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1); });
