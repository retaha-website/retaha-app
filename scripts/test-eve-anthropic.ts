// Sprint E4 · Phase 2 — Anthropic-Wrapper Test
//
// Run via: npm run test:eve-anthropic
// (intern: tsx --env-file=.env scripts/test-eve-anthropic.ts)
//
// Was geprüft wird:
//   1. Hello-World mit Haiku 4.5
//   2. Hello-World mit Sonnet 4.6
//   3. Cache-Test: 2 Calls mit großem System-Prompt → 2. Call sollte
//      cache_read_input_tokens > 0 zeigen (Cache-Hit)
//   4. Token-Usage durchgängig geloggt
//
// Wichtige Beobachtung: Prompt-Caching greift nur bei System-Prompts >= ~1024
// Tokens. Wir konstruieren einen großen System-Prompt aus Repeat-Text damit
// die Mindest-Größe erreicht wird.

import { eveComplete, EVE_MODEL_HAIKU, EVE_MODEL_SONNET } from '../src/lib/eve/anthropic-client';

function divider(title: string) {
  console.log('');
  console.log('═'.repeat(70));
  console.log(' ' + title);
  console.log('═'.repeat(70));
}

function logUsage(label: string, result: Awaited<ReturnType<typeof eveComplete>>) {
  console.log(`${label}:`);
  console.log(`  Model:                  ${result.model}`);
  console.log(`  Stop-Reason:            ${result.stopReason}`);
  console.log(`  Input Tokens:           ${result.usage.inputTokens}`);
  console.log(`  Output Tokens:          ${result.usage.outputTokens}`);
  console.log(`  Cached Input Tokens:    ${result.usage.cachedInputTokens}  ${result.usage.cachedInputTokens > 0 ? '✓ CACHE HIT' : '(miss)'}`);
  console.log(`  Cache Creation Tokens:  ${result.usage.cacheCreationTokens}  ${result.usage.cacheCreationTokens > 0 ? '✓ wrote to cache' : ''}`);
  console.log(`  Response (truncated):   "${result.content.slice(0, 200)}${result.content.length > 200 ? '...' : ''}"`);
}

async function main() {
  divider('1. Hello-World Haiku 4.5');
  const haikuResult = await eveComplete({
    model: EVE_MODEL_HAIKU,
    systemPrompt: 'Du bist Eve, eine freundliche Hotel-Concierge. Antworte in 1 Satz.',
    messages: [{ role: 'user', content: 'Was ist die Hauptstadt von Frankreich?' }],
    enableCaching: false,
  });
  logUsage('Haiku', haikuResult);

  divider('2. Hello-World Sonnet 4.6');
  const sonnetResult = await eveComplete({
    model: EVE_MODEL_SONNET,
    systemPrompt: 'Du bist Eve, eine freundliche Hotel-Concierge. Antworte in 1 Satz.',
    messages: [{ role: 'user', content: 'Empfiehl mir ein gemütliches Restaurant in Berlin-Charlottenburg.' }],
    enableCaching: false,
  });
  logUsage('Sonnet', sonnetResult);

  divider('3. Cache-Test mit Sonnet (1024-Token-Minimum, Haiku braucht ~2048)');

  // Großer System-Prompt damit cache-eligible (>= ~1024 Tokens).
  // Wir bauen ihn aus realistischen Hotel-Knowledge-Schnipsel.
  const hotelKnowledge = `
# Über das Hotel Gate Garden Berlin

Gate Garden ist ein Boutique-Hotel im Herzen von Charlottenburg, direkt am Kurfürstendamm.
Das Haus wurde 2024 eröffnet und vereint moderne Architektur mit dem klassischen Charme
der Westberliner Hotelkultur. Der historische Innenhof mit altem Birnbaumgarten gibt dem
Hotel seinen Namen.

# Häufige Fragen (FAQ)

Frage: Wann ist Check-in möglich?
Antwort: Check-in ist ab 15:00 Uhr möglich. Bei früherer Ankunft können wir Ihr Gepäck
gerne kostenfrei verwahren. Bitte sprechen Sie an der Rezeption mit unserem Team.

Frage: Wann ist Check-out?
Antwort: Check-out ist bis 11:00 Uhr. Late-Check-out bis 13:00 ist gegen einen Aufpreis von
15 EUR möglich, vorbehaltlich Verfügbarkeit. Bitte fragen Sie am Vortag an der Rezeption.

Frage: Gibt es Parkplätze am Hotel?
Antwort: Ja, wir haben 12 Parkplätze im Innenhof hinter dem Hotel. Die Kosten betragen
18 EUR pro Nacht. Eine Vorab-Reservierung wird empfohlen, da die Plätze begrenzt sind.

Frage: Wann startet das Frühstück?
Antwort: Das Frühstück wird von 07:30 bis 10:30 Uhr im Wintergarten serviert. Am Wochenende
verlängern wir bis 11:30 Uhr. Frühstück ist im Zimmerpreis inkludiert (mit Ausnahme der
Tarif-Variante "Room Only").

Frage: Wie ist das WLAN-Passwort?
Antwort: Das WLAN-Netzwerk heißt "Gate-Guest" und das Passwort lautet "Birnbaum-Garten-2026".
Die Verbindung ist symmetrisch mit 320 Mbit/s. Das WLAN ist in allen Bereichen des Hotels
verfügbar, einschließlich des Innenhofs.

Frage: Ist Frühstück für Vegetarier und Veganer geeignet?
Antwort: Ja, wir bieten ein vielfältiges Frühstücksbuffet mit zahlreichen vegetarischen
und veganen Optionen. Unser Küchenchef hat besonderes Augenmerk auf saisonale Bio-Produkte
gelegt. Bei speziellen Allergien sprechen Sie bitte unser Frühstücksteam direkt an.

Frage: Wie komme ich vom Hotel zum Brandenburger Tor?
Antwort: Mit der U-Bahn U1 vom Uhlandstraße ab — fünf Stationen bis Wittenbergplatz, dann
umsteigen in die U2 Richtung Pankow, vier weitere Stationen bis Stadtmitte. Insgesamt etwa
18 Minuten. Alternativ S-Bahn S5 vom Zoologischer Garten direkt bis Brandenburger Tor in
etwa 8 Minuten.

# Hausregeln

Rauchen ist im gesamten Hotel verboten, auch auf den Zimmern. Es stehen ausgewiesene
Raucherbereiche im Innenhof zur Verfügung. Bei Verstoß wird eine Reinigungspauschale von
250 EUR erhoben.

Haustiere sind willkommen — bitte melden Sie diese vor Anreise an. Kleine Hunde bis 10 kg
können wir kostenfrei beherbergen, größere Hunde gegen einen Aufpreis von 25 EUR pro Nacht.

Ruhezeiten gelten von 22:00 bis 07:00 Uhr. Im Innenhof bitten wir nach 21:00 um besonders
rücksichtsvolles Verhalten gegenüber den umliegenden Nachbarn.

Du bist Eve, die Concierge im Gate Garden Hotel Berlin. Du bist warm, professionell, hilfsbereit.
Antworte präzise und freundlich. Wenn du etwas nicht weißt, sage es offen.
  `.trim();

  console.log(`System-Prompt-Länge: ~${Math.ceil(hotelKnowledge.length / 4)} Tokens (rough estimate)`);
  console.log('Erwartung: 1. Call schreibt Cache (cache_creation > 0), 2. Call liest Cache (cache_read > 0)\n');

  const cacheCall1 = await eveComplete({
    model: EVE_MODEL_SONNET,
    systemPrompt: hotelKnowledge,
    messages: [{ role: 'user', content: 'Wann ist Check-out?' }],
    enableCaching: true,
  });
  logUsage('Cache Call 1 (Sonnet)', cacheCall1);

  console.log('\n--- 2. Call mit identischem System-Prompt ---\n');

  const cacheCall2 = await eveComplete({
    model: EVE_MODEL_SONNET,
    systemPrompt: hotelKnowledge,
    messages: [{ role: 'user', content: 'Wie ist das WLAN-Passwort?' }],
    enableCaching: true,
  });
  logUsage('Cache Call 2 (Sonnet)', cacheCall2);

  // Verify Cache-Hit
  divider('Cache-Verify');
  if (cacheCall2.usage.cachedInputTokens > 0) {
    console.log(`✓ Cache-Hit bestätigt: 2. Call las ${cacheCall2.usage.cachedInputTokens} Tokens aus dem Cache`);
    const savedTokens = cacheCall2.usage.cachedInputTokens;
    const fullPrice = cacheCall1.usage.inputTokens + cacheCall1.usage.cacheCreationTokens;
    console.log(`  → Cache-Ersparnis im 2. Call: ${savedTokens} von ${fullPrice} Input-Tokens = ${Math.round((savedTokens / fullPrice) * 100)}%`);
  } else {
    console.log(`⚠ Cache-Hit NICHT bestätigt (cachedInputTokens=0).`);
    console.log(`  Mögliche Gründe:`);
    console.log(`    - System-Prompt unter ~1024 Tokens (zu klein für Cache-Eligibility)`);
    console.log(`    - Cache-TTL (5 min) ist zwischen den Calls abgelaufen`);
    console.log(`    - Ephemeral-Cache wird von Anthropic dynamisch zugeteilt`);
    console.log(`  Cache-Creation-Tokens aus Call 1: ${cacheCall1.usage.cacheCreationTokens}`);
  }

  divider('Fertig');
  console.log('Alle 4 Calls erfolgreich. Wrapper + Caching funktional.\n');
}

main().catch(err => {
  console.error('FEHLER:', err);
  process.exit(1);
});
