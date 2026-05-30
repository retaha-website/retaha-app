// Sprint E4 · Phase 8 — Eve Chat-Endpoint Test
//
// Run via: npm run test:eve-chat (Dev-Server muss laufen auf localhost:4321)
//
// 1. Signiert eine Stay-Session manuell (Test-Convenience, im Echtbetrieb
//    kommt der Cookie aus /api/pair Sprint D Phase 3)
// 2. Sendet POST /api/eve/chat mit Stay-Session-Cookie
// 3. Parst SSE-Stream + loggt alle Chunks live
// 4. Verifiziert chat_messages-Persistenz

import { createClient } from '@supabase/supabase-js';
import { signStaySession, STAY_COOKIE_NAME } from '../src/lib/auth/stay-session';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_HOTEL_ID = '1f30ac02-17e1-47b6-9bda-487e14b07627';
const ENDPOINT = 'http://localhost:4321/api/eve/chat';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function divider(t: string) {
  console.log('');
  console.log('═'.repeat(78));
  console.log(' ' + t);
  console.log('═'.repeat(78));
}

async function streamRequest(cookie: string, message: string): Promise<{
  chunkCount: number;
  chunks: any[];
  fullText: string;
}> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`HTTP ${response.status}:`, errBody);
    return { chunkCount: 0, chunks: [], fullText: '' };
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const chunks: any[] = [];
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE: "data: {...}\n\n"
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';

    for (const block of lines) {
      const line = block.trim();
      if (!line.startsWith('data:')) continue;
      const json = line.slice(5).trim();
      try {
        const obj = JSON.parse(json);
        chunks.push(obj);
        if (obj.type === 'text_delta') {
          process.stdout.write(obj.text);
          fullText += obj.text;
        } else if (obj.type === 'router_decision') {
          console.log(`[router] → ${obj.model} (${obj.reason})`);
        } else if (obj.type === 'tool_use_preview') {
          console.log(`\n[tool] ${obj.tool_name}...`);
        } else if (obj.type === 'pending_action') {
          console.log(`\n[pending_action] ${obj.action.summary?.title} — ${obj.action.action_type}`);
        } else if (obj.type === 'escalating') {
          console.log(`\n[escalating] ${obj.from} → ${obj.to} (${obj.reason})`);
        } else if (obj.type === 'message_complete') {
          console.log(`\n[done] tokens: in=${obj.usage.inputTokens} out=${obj.usage.outputTokens} cached=${obj.usage.cachedInputTokens}`);
        } else if (obj.type === 'error') {
          console.error(`\n[ERROR] ${obj.message}`);
        }
      } catch (e) {
        console.warn('JSON-Parse-Fehler in chunk:', json);
      }
    }
  }

  return { chunkCount: chunks.length, chunks, fullText };
}

async function main() {
  // 1. Aktiven Stay finden
  const { data: stay } = await sb.from('stays')
    .select('id, hotel_id, check_out, guests(first_name)')
    .eq('hotel_id', DEMO_HOTEL_ID).eq('is_active', true)
    .in('state', ['Confirmed', 'Started']).limit(1).single();
  if (!stay) { console.error('Kein aktiver Stay'); process.exit(1); }
  console.log(`Test-Stay: ${stay.id} · Gast: ${(stay.guests as any)?.first_name ?? '(no name)'}`);

  // 2. Stay-Session-JWT signieren
  const jwt = await signStaySession({
    stay_id: stay.id,
    hotel_id: stay.hotel_id,
    check_out_utc: stay.check_out,
  });
  if (!jwt) { console.error('JWT-Sign fehlgeschlagen (STAY_SESSION_SECRET?)'); process.exit(1); }
  const cookie = `${STAY_COOKIE_NAME}=${jwt}`;
  console.log(`Cookie: ${STAY_COOKIE_NAME}=${jwt.slice(0, 30)}...`);

  // 3. Vorhandene chat_messages der Stay zählen (Baseline)
  const { count: beforeCount } = await sb.from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('stay_id', stay.id);
  console.log(`chat_messages vorher: ${beforeCount ?? 0}`);

  // ─── Test 1: Einfache FAQ-Frage (sollte default_haiku triggern) ──
  divider('Test 1 — "Wie ist das WLAN-Passwort?"  (erwartet: default_haiku, kein Tool)');
  const r1 = await streamRequest(cookie, 'Wie ist das WLAN-Passwort?');
  console.log(`\n→ ${r1.chunkCount} chunks insgesamt`);

  // ─── Test 2: Lookup-Tool-Trigger ──────────────────────────────
  divider('Test 2 — "Was gibt es zum Frühstück?"  (erwartet: tool get_breakfast_menu)');
  const r2 = await streamRequest(cookie, 'Was gibt es zum Frühstück?');
  console.log(`\n→ ${r2.chunkCount} chunks insgesamt`);

  // ─── Verifikation: chat_messages persistiert ──────────────────
  divider('Verifikation chat_messages');
  const { data: messages, count: afterCount } = await sb.from('chat_messages')
    .select('role, content, model_used, prompt_tokens, completion_tokens, cached_input_tokens, tool_calls, router_decision, created_at', { count: 'exact' })
    .eq('stay_id', stay.id)
    .order('created_at', { ascending: false })
    .limit(6);
  console.log(`chat_messages nachher: ${afterCount ?? 0}  (Δ ${(afterCount ?? 0) - (beforeCount ?? 0)})`);

  if (messages && messages.length > 0) {
    console.log('\nLetzte Messages (newest first):');
    for (const m of messages.slice(0, 4)) {
      const preview = m.content.slice(0, 80).replace(/\n/g, ' ');
      console.log(`  [${m.role.padEnd(9)}] "${preview}${m.content.length > 80 ? '...' : ''}"`);
      if (m.role === 'assistant') {
        console.log(`    model=${m.model_used} prompt=${m.prompt_tokens} compl=${m.completion_tokens} cached=${m.cached_input_tokens}`);
        if (m.tool_calls) console.log(`    tool_calls=${JSON.stringify(m.tool_calls).slice(0, 100)}`);
        if (m.router_decision) console.log(`    router=${JSON.stringify(m.router_decision)}`);
      }
    }
  }
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1); });
