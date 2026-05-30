// Sprint E4 · Phase 3 — Router-Logic Test
//
// Run via: npm run test:eve-router
// (intern: tsx --env-file=.env scripts/test-eve-router.ts)
//
// 13 Mock-Cases (5 Trigger × min 1-2 Cases + multilingual Coverage).
// Plus 4 low-confidence Re-Try Detection Cases.
//
// Kein Anthropic-API-Call — reine Logic-Verifikation. Schnell + kostenlos.

import {
  decideModel,
  isLowConfidenceResponse,
  escalateLowConfidence,
  type RouterDecision,
  type ChatHistoryMessage,
  type TuningRule,
} from '../src/lib/eve/router';
import { EVE_MODEL_HAIKU, EVE_MODEL_SONNET } from '../src/lib/eve/anthropic-client';

interface TestCase {
  label: string;
  userMessage: string;
  history?: ChatHistoryMessage[];
  tuningRules?: TuningRule[];
  expectedReason: RouterDecision['reason'];
  expectedModel: 'haiku' | 'sonnet';
}

const CASES: TestCase[] = [
  // ────────────────── DEFAULT (Haiku) ──────────────────
  {
    label: 'DEFAULT — kurze Standard-Frage',
    userMessage: 'Wann ist Frühstück?',
    expectedReason: 'default_haiku',
    expectedModel: 'haiku',
  },
  {
    label: 'DEFAULT — sehr kurze EN-Frage',
    userMessage: 'Wifi password?',
    expectedReason: 'default_haiku',
    expectedModel: 'haiku',
  },
  // ────────────────── LONG_CONVERSATION ──────────────────
  {
    label: 'LONG_CONVERSATION — 3 Messages in History',
    userMessage: 'Und noch eine Frage dazu',
    history: [
      { role: 'user', content: 'Wann ist Check-out?' },
      { role: 'assistant', content: '11:00 Uhr.' },
      { role: 'user', content: 'Late check-out möglich?' },
    ],
    expectedReason: 'long_conversation',
    expectedModel: 'sonnet',
  },
  // ────────────────── LONG_QUESTION ──────────────────
  {
    label: 'LONG_QUESTION — 22 Wörter Anfrage',
    userMessage:
      'Hallo, ich möchte gerne wissen ob es möglich ist heute Abend einen Tisch für vier Personen in eurem Restaurant zu reservieren bitte.',
    expectedReason: 'long_question',
    expectedModel: 'sonnet',
  },
  // ────────────────── RECOMMENDATION_REQUEST ──────────────────
  {
    label: 'RECOMMENDATION (DE) — "Empfiehl mir"',
    userMessage: 'Empfiehl mir bitte ein gutes Restaurant heute Abend',
    expectedReason: 'recommendation_request',
    expectedModel: 'sonnet',
  },
  {
    label: 'RECOMMENDATION (DE) — "Empfiehl mir was Schönes" (Vokalwechsel-Fall ohne Backup-Trigger)',
    userMessage: 'Empfiehl mir was Schönes',
    expectedReason: 'recommendation_request',
    expectedModel: 'sonnet',
  },
  {
    label: 'RECOMMENDATION (DE) — "Hast du eine Empfehlung?"',
    userMessage: 'Hast du eine Empfehlung?',
    expectedReason: 'recommendation_request',
    expectedModel: 'sonnet',
  },
  {
    label: 'RECOMMENDATION (DE) — "Wo gibt es"',
    userMessage: 'Wo gibt es hier in der Nähe eine gemütliche Bar?',
    expectedReason: 'recommendation_request',
    expectedModel: 'sonnet',
  },
  {
    label: 'RECOMMENDATION (EN) — "where can I"',
    userMessage: 'Where can I get good coffee nearby?',
    expectedReason: 'recommendation_request',
    expectedModel: 'sonnet',
  },
  {
    label: 'RECOMMENDATION (FR) — "où puis-je"',
    userMessage: 'Bonjour, où puis-je trouver une bonne boulangerie?',
    expectedReason: 'recommendation_request',
    expectedModel: 'sonnet',
  },
  {
    label: 'RECOMMENDATION (ES) — "recomien"',
    userMessage: '¿Me recomiendas algo?',
    expectedReason: 'recommendation_request',
    expectedModel: 'sonnet',
  },
  // ────────────────── TOOL_USE_REQUIRED (Tuning-Rule) ──────────────────
  {
    label: 'TUNING — Hotelier forced sonnet bei "konferenz"',
    userMessage: 'Ich brauche einen Konferenzraum für morgen',
    tuningRules: [
      { trigger: 'konferenz', force_model: 'sonnet', instruction: 'Sei besonders sorgfältig bei Konferenz-Anfragen.' },
    ],
    expectedReason: 'tool_use_required',
    expectedModel: 'sonnet',
  },
  {
    label: 'TUNING — Match obwohl auch recommendation-Keyword da wäre (Priorität: Rule first)',
    // "restaurant" wäre Recommendation-Trigger, aber Hotelier-Rule überschreibt.
    userMessage: 'Welches restaurant empfiehlst du?',
    tuningRules: [
      { trigger: 'restaurant', force_model: 'sonnet', instruction: 'Immer hauseigenes Restaurant zuerst.' },
    ],
    expectedReason: 'tool_use_required',
    expectedModel: 'sonnet',
  },
  {
    label: 'TUNING — Rule ohne force_model wird ignoriert (Fallback auf default)',
    userMessage: 'Was ist die WLAN-Speed?',
    tuningRules: [
      { trigger: 'wlan', instruction: 'Erkläre dass WLAN inkludiert ist.' },  // kein force_model
    ],
    expectedReason: 'default_haiku',
    expectedModel: 'haiku',
  },
  // ────────────────── EDGE-CASES ──────────────────
  {
    label: 'EDGE — 2 Messages (= unter Threshold, default)',
    userMessage: 'Danke!',
    history: [
      { role: 'user', content: 'Was ist Check-in-Zeit?' },
      { role: 'assistant', content: '15:00 Uhr.' },
    ],
    expectedReason: 'default_haiku',
    expectedModel: 'haiku',
  },
  {
    label: 'EDGE — exakt 20 Wörter (Grenze inklusive)',
    userMessage:
      'Hallo bitte sagen sie mir die genaue Adresse vom Hotel und die nächste U-Bahn dorthin und auch die Buslinie ja',
    expectedReason: 'long_question',
    expectedModel: 'sonnet',
  },
];

interface LowConfCase {
  label: string;
  response: string;
  expected: boolean;
}

const LOW_CONF_CASES: LowConfCase[] = [
  {
    label: 'LOW-CONF (DE) — "Ich bin mir nicht sicher"',
    response: 'Ich bin mir nicht sicher, ob das Hotel einen Saunabereich hat.',
    expected: true,
  },
  {
    label: 'LOW-CONF (DE) — "Müssen Sie an der Rezeption"',
    response: 'Das müssen Sie an der Rezeption erfragen, ich habe dazu keine Information.',
    expected: true,
  },
  {
    label: 'LOW-CONF (EN) — "I am not sure"',
    response: 'I am not sure about the spa hours, please ask reception.',
    expected: true,
  },
  {
    label: 'LOW-CONF (FR) — "je ne sais pas"',
    response: 'Désolé, je ne sais pas si le spa est ouvert ce soir.',
    expected: true,
  },
  {
    label: 'LOW-CONF — NEGATIV: konfidente Antwort',
    response: 'Der Spa ist täglich von 09:00 bis 21:00 geöffnet.',
    expected: false,
  },
];

function divider(t: string) {
  console.log('');
  console.log('═'.repeat(80));
  console.log(' ' + t);
  console.log('═'.repeat(80));
}

function runDecisionTests(): { passed: number; failed: number } {
  divider('Router-Decision Tests (' + CASES.length + ' Cases)');

  let passed = 0;
  let failed = 0;

  for (const tc of CASES) {
    const decision = decideModel(
      tc.userMessage,
      tc.history ?? [],
      tc.tuningRules ?? [],
    );

    const modelOk =
      (tc.expectedModel === 'haiku' && decision.model === EVE_MODEL_HAIKU) ||
      (tc.expectedModel === 'sonnet' && decision.model === EVE_MODEL_SONNET);
    const reasonOk = decision.reason === tc.expectedReason;
    const ok = modelOk && reasonOk;

    const badge = ok ? '✓' : '✗';
    const expectedShort = `${tc.expectedModel}/${tc.expectedReason}`;
    const actualShort = `${tc.expectedModel === 'haiku' && decision.model === EVE_MODEL_HAIKU ? 'haiku' : 'sonnet'}/${decision.reason}`;

    console.log(`${badge} ${tc.label}`);
    if (!ok) {
      console.log(`    Expected: ${expectedShort}`);
      console.log(`    Actual:   ${actualShort}`);
    }
    // Decision-Details (Debug-Info)
    const extras: string[] = [];
    if (decision.history_length !== undefined) extras.push(`history=${decision.history_length}`);
    if (decision.word_count !== undefined) extras.push(`words=${decision.word_count}`);
    if (decision.matched_keyword !== undefined) extras.push(`kw="${decision.matched_keyword}"`);
    if (decision.matched_tuning_rule_index !== undefined) extras.push(`rule#${decision.matched_tuning_rule_index}`);
    if (extras.length > 0) console.log(`    → ${decision.reason} [${extras.join(', ')}]`);

    if (ok) passed++;
    else failed++;
  }

  return { passed, failed };
}

function runLowConfTests(): { passed: number; failed: number } {
  divider('Low-Confidence-Detection Tests (' + LOW_CONF_CASES.length + ' Cases)');

  let passed = 0;
  let failed = 0;

  for (const tc of LOW_CONF_CASES) {
    const result = isLowConfidenceResponse(tc.response);
    const ok = result === tc.expected;
    const badge = ok ? '✓' : '✗';
    console.log(`${badge} ${tc.label}`);
    if (!ok) {
      console.log(`    Expected: ${tc.expected}`);
      console.log(`    Actual:   ${result}`);
    }
    if (ok && tc.expected) {
      const escalated = escalateLowConfidence(tc.response);
      console.log(`    → escalated to ${escalated.model.includes('sonnet') ? 'sonnet' : 'haiku'} (reason=${escalated.reason})`);
    }
    if (ok) passed++;
    else failed++;
  }

  return { passed, failed };
}

const d = runDecisionTests();
const l = runLowConfTests();

divider('Zusammenfassung');
const totalPassed = d.passed + l.passed;
const totalFailed = d.failed + l.failed;
console.log(`Decision-Tests:  ${d.passed} / ${d.passed + d.failed}`);
console.log(`Low-Conf-Tests:  ${l.passed} / ${l.passed + l.failed}`);
console.log(`GESAMT:          ${totalPassed} / ${totalPassed + totalFailed}`);

if (totalFailed > 0) {
  console.log('\n✗ Tests fehlgeschlagen');
  process.exit(1);
}
console.log('\n✓ Alle Tests grün');
