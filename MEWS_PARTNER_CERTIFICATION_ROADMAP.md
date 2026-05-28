# Mews · Partner-Registrierung + Certification-Roadmap

> Stand: 28.05.2026
> Zweck: Vorlauf-Themen früh anstoßen (Demo-Account + Certification-Verständnis)

---

## Die Mews Partner-Journey (6 Schritte)

```
1. Marketplace Registration  →  Partner ID (INT12345)     [JETZT]
2. API wählen: Connector API                              [✓ erledigt]
3. Bauen + Testen im Demo                                 [läuft — MVP]
4. Certification Form ausfüllen                           [wenn MVP fertig]
5. Daten-Review durch Mews (min. 48h Daten, automatisiert) [~1-2 Wochen]
6. Pilot-Property (~4 Wochen Monitoring) → Marketplace    [mit Gate Garden]
```

**Kernfakten:**
- Connector API: **self-service + kostenlos**
- Certification: **kein Call nötig** (nur Channel API braucht 90-min-Call), automatisierter Daten-Review
- Pilot: ~4 Wochen Monitoring an echter Property (= Gate Garden)

---

## Zeit-Einordnung

| Phase | Dauer | Wann |
|---|---|---|
| Partner-Registrierung + Demo-Account | 1-2 Tage | **jetzt** |
| MVP bauen | 12-15 Wochen | läuft |
| Certification Form + Daten-Review | 1-2 Wochen | nach MVP |
| Pilot mit Gate Garden | ~4 Wochen | nach Certification |
| **Bis "live mit echten Gästen"** | MVP + ~6-8 Wochen | — |

**Wichtig:** Certification + Pilot kommen NACH dem MVP-Bau. Aber Partner-ID + eigenes Demo-Property JETZT holen spart später Zeit (Vorlauf).

---

## Strategie (entschieden): Erst bauen, dann alles auf einmal anfragen

**Entscheidung 28.05.2026:** Wir senden NICHT jetzt eine Demo-Anfrage. Stattdessen folgen wir dem Mews-intended Flow:
1. **Erst** alle MVP-Module bauen + die definitive Endpoint-Liste festlegen
2. **Dann** eine fundierte Anfrage senden (eigenes Demo + Partner ID + Certification-Vorbereitung) — alles auf einmal, mit vollständiger Info

Begründung: Die Mews-Mail sagt selbst "When you've decided which endpoints to use and how...". Die Certification Form verlangt detaillierte technische Infos (Endpoints, Frequenz, Workflow) — die können wir erst vollständig beantworten wenn die Module stehen. Halbgar anfragen = Rückfragen = Verzögerung.

**Zum Bauen brauchen wir aktuell NICHTS Neues von Mews** — die öffentliche Demo (api.mews-demo.com) ist der offizielle Connector-API-Bau-Weg.

### Endpoint-Tracking (laufend pflegen)

**Schon genutzt (Sprint 0-5):**
- `configuration/get` — Hotel-Konfiguration
- `resources/getAll` — Zimmer (Extent: Resources + Categories + Assignments)
- `reservations/getAll/2023-06-06` — Reservierungen (CollidingUtc + Limitation + Pagination)
- `customers/getAll` — Gäste (CustomerIds-Filter + Limitation)

**Kommend (noch nicht final — wird sich in den Sprints zeigen):**
- `orders/add` oder `accountingItems/add` — Charge to Room (Frühstück/Service/Konferenz)
- Webhook `ServiceOrderUpdated` — Check-out-Trigger für Wallet
- evtl. `services/getAll` — Frühstück-Service-Definition
- evtl. weitere für Pricing/Availability

**→ Diese Liste laufend ergänzen. Wenn MVP-Module stehen = finale Liste = Trigger für die Mews-Anfrage + Certification.**

### Mail-Trigger (wann senden)

Die Mail an partnersuccess@mews.com (Vorlage unten) senden wir, **wenn die MVP-Module stehen** und die Endpoint-Liste final ist. Dann fragen wir in einem Aufwasch: eigenes Demo-Property + Partner ID + Certification-Timeline.

### Certification-konform bauen (machen wir durchgehend)

Worauf Mews bei der Certification schaut (und was wir schon tun):
- ✓ Richtige Endpoints für den Workflow (Reservations, Customers, Resources)
- ✓ Use-Case-konforme Implementierung
- ✓ Fehler-Handling (wir haben MewsApiError + Retry)
- ✓ Angemessene Call-Frequenz + Filter (CollidingUtc, Limitation, State-Filter)
- ✓ Rate-Limit-Handling (429 + exponential backoff)

Wir bauen also schon certification-konform. Kein nachträglicher Umbau nötig.

---

## Mail-Vorlage an partnersuccess@mews.com

**Betreff:** Request for dedicated Demo Property — retaha (Guest Experience Integration)

```
Hello Mews Partner Success Team,

we are building retaha, a guest-experience integration for the Connector API
(digital guest interface: breakfast booking, service requests, concierge,
post-stay wallet — all served to hotel guests via NFC/QR).

We have already started development against the public demo environment and
would now like to request access to a dedicated Demo Property so we can test
with a clean, reproducible dataset.

Could you please:
1. Confirm our Partner ID (or let us know how to obtain one if we don't have it yet)
2. Set up user access to a dedicated Demo Property for our team

Our registered email: [deine Mews-Registrierungs-Email]
Company: retaha GmbH (Germany)

We'd also appreciate any guidance on the Connector API certification timeline,
as we're planning a pilot with a boutique hotel in Berlin later this year.

Thank you very much!

Best regards,
Taha [Nachname]
retaha GmbH
```

---

## Nach diesem Schritt

- Demo-Account-Anfrage raus → 1-2 Tage warten auf Antwort
- Parallel: MVP weiterbauen (Frontend mit den vorhandenen Daten)
- Wenn eigenes Demo da: Sync gegen sauberes Demo testen
- Certification Form: erst wenn MVP fertig + getestet

**Der Bau geht parallel weiter — wir warten nicht auf Mews.** Die Demo-Anfrage ist Vorlauf für später.
