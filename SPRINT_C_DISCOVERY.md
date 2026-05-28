# Sprint C · Discovery — Charge-to-Room (orders/add)

> Stand: 2026-05-28 · Methode: Read-only Code-Scan (kein Code-Change).
> Briefing: `BRIEFING_SPRINT_C_CHARGE_TO_ROOM.md` (extern, nicht im Repo).
> Ergebnis: 4 Discovery-Antworten + **3 kritische Findings** die das Sprint-C-Design beeinflussen — Freigabe erforderlich vor Bau.

---

## A · `bookings.details`-jsonb pro Typ

Sender-Seite ist `src/pages/g/[token].astro` (Gast-Frontend). Drei separate POST-Payloads:

**breakfast** — `[token].astro:881-887`:
```json
{
  "date": "2026-05-30",
  "time": "08:00",
  "people": 2,
  "table_preference": "inside",   // inside | outside | garden | any
  "notes": null
}
```

**conference** — `[token].astro:992-1001`:
```json
{
  "room_id": "uuid",
  "room_name": "Konferenzraum A",
  "date": "2026-05-30",
  "time": "14:00",
  "duration_hours": 2,
  "people": 8,
  "occasion": "Teammeeting",
  "notes": null
}
```

**service** — `[token].astro:1073-1079`:
```json
{
  "item_id": "uuid",
  "item_name": "Massage im Zimmer",
  "timing": "scheduled",          // now | scheduled
  "time": "19:00",
  "notes": null
}
```

**Gemeinsam:** alle haben `time` (außer `timing=now` bei service). **NICHT gemeinsam:** Item-Liste (nur breakfast hat mehrere personen, service/conference einen Slot). **Komplett fehlend in allen:** Preis, Anzahl-Items (außer service implizit 1, breakfast `people`, conference `duration_hours`).

---

## B · Persistierung-Slots

**`mews_integrations`** ([sprint01_mews_integration_schema.sql:111-123](supabase/migrations/20260528_sprint01_mews_integration_schema.sql#L111)):
- Bestehend: `hotel_id (PK)`, `enterprise_id`, `access_token_encrypted`, `environment`, `last_sync_at`, `sync_status`, `sync_error_message`, `created_at`, `updated_at`
- **Fehlt:** `default_service_id` (Mews orderable), `default_currency`, `default_tax_code(s)`, `default_accounting_category_id`
- Semantisch korrekter Slot: gehört in `mews_integrations` (Mews-PMS-Connector-Daten, nicht Hotelier-UI-Settings)

**`hotel_settings`**:
- Bestehend (UI-Config): `features`, `recommendations`, breakfast/conference/service-Konfig (`conference_rooms`, `service_items`, …), Welcome-Messages, Wifi
- **Falscher Slot** für Mews-Defaults — `hotel_settings` ist hotelier-editierbar via Backoffice, `mews_integrations` ist Connector-State.

**`bookings.mews_order_id`** ([sprint01_mews_integration_schema.sql:106](supabase/migrations/20260528_sprint01_mews_integration_schema.sql#L106)):
- ✅ Spalte existiert bereits als `TEXT`, ready.

---

## C · `configuration/get` Cache-Status

- **Nicht gecacht.** Wird nur in [pms.astro:~88](src/pages/admin/pms.astro#L88) beim Connect-Roundtrip aufgerufen (Token-Validierung + Enterprise.Id-Extraktion).
- `MewsClient.getConfiguration()` ([client.ts:107](src/lib/mews/client.ts#L107)) ist lightweight, versionslos, keine Limitation.
- **Sprint-C-konform:** beim Connect erneut aufrufen, dabei zusätzlich `Enterprise.Currencies` (IsDefault=true → Currency-Code) extrahieren + speichern. Kein separater Cache nötig.

---

## D · `bookings.status`-Workflow

**Erlaubte Werte** (Whitelist [update-status.ts:4](src/pages/api/bookings/update-status.ts#L4)): `pending`, `confirmed`, `cancelled`.

**Sequenz:**
```
INSERT [create.ts:54]  → pending   (immer; Gast-Frontend kann nichts anderes)
admin/bookings.astro   → confirmed (Hotelier klickt "Bestätigen")
admin/bookings.astro   → cancelled (Hotelier klickt "Ablehnen")
admin/bookings.astro   → pending   (Hotelier klickt Reset "↺")
```

Update-Pfad: [admin/bookings.astro:367-426](src/pages/admin/bookings.astro#L367) sendet `POST /api/bookings/update-status` → [update-status.ts:39-46](src/pages/api/bookings/update-status.ts#L39) macht den UPDATE über SSR-Client (RLS-gesichert, owner-only).

**Direkt-Confirm beim Insert: nicht implementiert.** Gast-Bookings sind immer `pending`, Hotelier bestätigt manuell.

---

# Drei kritische Findings für Sprint-C-Design

## 🔴 Finding 1 — KEINE Preise in der DB (Blocker)

Grep über alle Migrations + Code: **keine `price`, `price_cents`, `cost`, `currency`-Spalte** auf `breakfast_items`, `conference_rooms`, `service_items` oder `hotel_settings`. Bestätigt durch [queries.ts:200-237](src/lib/queries.ts#L200) `BreakfastItem`-Interface (Name, Beschreibung, 14 EU-Allergens, Diet-Flags — kein Preis).

**Konsequenz:** Mews `orders/add` braucht `Items[].UnitAmount.NetValue` (Decimal). Ohne Preis in unserer DB können wir keinen echten Charge pushen.

**Drei Lösungspfade (eine Entscheidung erforderlich):**

| Pfad | Beschreibung | Aufwand | Mews-Sauberkeit |
|------|--------------|---------|-----------------|
| **A. Preis-Spalten ergänzen** | Migration: `breakfast_items.price_cents`, `conference_rooms.price_cents_per_hour`, `service_items.price_cents`. Backoffice-UIs ergänzen damit Hotelier Preise einpflegen kann. | Mittel (~2h Migration + 3 Admin-UIs) | Beste — Items mit korrekten Preisen |
| **B. NetValue: 0** | Push die Orders ohne Preis. Hotelier sieht den Item in Mews als „Charge", muss Preis manuell setzen / über separaten Posting-Workflow ergänzen. | Klein (~30 min) | Symbolisch — Gast wird nicht korrekt abgerechnet ohne manuelle Intervention |
| **C. ProductOrders statt Items** | Mews hat `productOrders` mit `ProductId` (Mews-seitig konfigurierte Produkte mit Preis). Hotelier legt in Mews die Produkte an, wir mappen `breakfast_items.id` → `mews_product_id`. | Groß (~6h + Hotelier-Setup pro Hotel) | „Korrekt" nach Mews-Idiom, aber Onboarding-Hürde |

**Empfehlung:** Pfad A (Preis-Spalten ergänzen) — macht das Produkt vollständig + ist Voraussetzung dafür, dass „Charge-to-Room" wirklich Geld verschiebt. Pfad B als Interim wenn der MVP-Demo vor der Investor-Demo nicht aufgehalten werden soll.

---

## 🟡 Finding 2 — Einhängestelle ist NICHT `/api/bookings/create`

Brief sagt: „In `/api/bookings/create` … nach erfolgreichem INSERT in bookings". Discovery zeigt: **bei create ist status=pending**, Hotelier muss erst bestätigen. Ein Push beim CREATE würde jede Test-/Spam-/Versehen-Buchung sofort als Mews-Order anlegen, bevor der Hotelier sie geprüft hat.

**Korrekter Einhängepunkt:** [/api/bookings/update-status.ts:39-46](src/pages/api/bookings/update-status.ts#L39) — Mews-Push wenn `status → confirmed`.

**Logik:**
- `pending → confirmed`: orders/add aufrufen, `mews_order_id` persistieren
- `confirmed → cancelled`: orders/cancel? **Open Question** — Brief erwähnt das nicht
- `confirmed → pending` (Reset): orders/cancel + `mews_order_id` löschen? **Open Question**

**Empfehlung Sprint C Scope:** nur Push beim pending→confirmed. Cancel/Reset = ignorieren (mews_order_id bleibt stehen, Hotelier muss Order manuell in Mews stornieren). Cancel-Symmetrie als Sprint D oder Backlog.

---

## 🟡 Finding 3 — `Items[].Name` braucht Lookup, nicht nur details

Details enthalten teils nur IDs (z.B. `service.item_id`), Name evtl. veraltet wenn Hotelier umbenannt hat. Plus für Preis (Finding 1) brauchen wir eh den Lookup.

**Architektur:** ein `pushBookingToMews(booking)`-Helper resolved alle Felder via JOIN/Lookup:
- `bookings → stays → guests` (`mews_customer_id`, `mews_reservation_id`)
- `bookings.details.item_id → service_items / breakfast_items / conference_rooms` (Name + Preis)
- `bookings.hotel_id → mews_integrations` (service_id, currency, tax_code)

Sauber kapseln in `src/lib/mews/orders.ts` oder Erweiterung von `src/lib/mews/sync.ts`.

---

# Verbleibende Mews-Open-Questions für Schritt 1c (Test-Script)

Diese kannst du nicht ohne Live-Roundtrip beantworten — der Test-Script-Output wird sie klären:

1. **Service.Type-Werte beobachten:** Brief spekuliert "Reservable/Outlet/Service/AdditionalServices" — welche Types liefert das Demo-Hotel wirklich + welcher ist „Orderable"?
2. **TaxCodes:** welche Codes akzeptiert das Demo-Hotel (DE-spezifisch? Generic?) — iterativ ermitteln aus 400er-Responses.
3. **AccountingCategoryId:** Pflicht oder optional? Erst ohne probieren.
4. **ConsumptionUtc:** akzeptiert Mews zukünftige Daten (z.B. Frühstück morgen 08:00) oder nur Vergangenheit/jetzt?

---

# STOP — Entscheidungen vor Schritt 1

Bevor ich mit Schritt 1 (Client-Methoden + Test-Script) loslege, brauche ich drei Entscheidungen:

| # | Frage | Optionen |
|---|-------|----------|
| 1 | **Preise** | A (Spalten ergänzen + Admin-UIs) / B (NetValue: 0 als Interim) / C (Mews ProductOrders) |
| 2 | **Einhängepunkt** | confirmed (empfohlen) / create (Brief-Original) |
| 3 | **Cancel/Reset-Symmetrie** | Ignorieren für Sprint C (empfohlen) / orders/cancel-Pfad mitbauen |

Plus organisatorisch: lass mich `SPRINT_C_DISCOVERY.md` ins Repo committen vor Bau-Start?
