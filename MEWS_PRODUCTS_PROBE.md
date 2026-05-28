# Mews Products/Services-Probe — Befunde

> Stand: 2026-05-28 · Methode: Read-only Roundtrips gegen Demo-Hotel.
> Script: `scripts/probe-mews-products.ts` (npm run probe:mews-products).
> Zweck: vor Sprint C die Annahmen aus dem Briefing gegen die echte Mews-Realität prüfen.

---

## TL;DR — Probe-Output in 5 Zeilen

1. **Demo-Hotel ist UK-Tax-Environment, nicht DE/EU** (`TaxEnvironmentCode=UK-2022`, `Pricing=Gross`, Default-Currency `GBP`)
2. **2 Service-Types existieren:** `Orderable` und `Reservable`. „Orderable" ist der richtige für `orders/add`.
3. **Products: 0** in der Top-Level-Response → **Pfad C+ (Mews als Preis-Source-of-Truth) ist nicht realistisch ohne Hotelier-Setup**
4. **`reservations/getAll` mit `Extent.Items=true` liefert KEINE Items mit** — Extent wird ignoriert oder die Reservations haben einfach keine Items. Top-Level-Keys: `[ 'Reservations', 'Cursor' ]` — Items/Customers fehlen komplett.
5. **Currencies:** 27 verschiedene, EUR ist `IsEnabled: true` aber `IsDefault: false`. Default ist GBP.

---

## D · `configuration/get` — was uns wirklich erwartet

```
Enterprise.Name:                  "API Hotel Gross Pricing (DO NOT CHANGE THE NAME)"
Enterprise.Id:                    851df8c8-90f2-4c4a-8e01-a4fc46b25178
Enterprise.Pricing:               "Gross"          ← wichtig
Enterprise.TaxPrecision:          2
Enterprise.TaxEnvironmentCode:    "UK-2022"        ← bestimmt welche Tax-Codes valid sind
Enterprise.LegalEnvironmentCode:  "UK-2022"
Enterprise.AccountingEnvCode:     "UK"
Enterprise.DefaultLanguageCode:   "en-US"
Enterprise.Address.CountryCode:   "IT"             ← Adresse Italien, aber Steuer UK (irrelevant)
Default-Currency (IsDefault=true): "GBP"
```

**Kein Feld `AcceptedCurrencyCodes` mehr** (war v1) — stattdessen `Enterprise.Currencies[]` mit `{Currency, IsDefault, IsEnabled}`.

**Top-Level-Keys:** `NowUtc`, `Enterprise`, `Service`, `PaymentCardStorage`, `IsIdentityDocumentNumberRequired` — kein `Services` (Plural), das war nur in v1.

**Tax-Codes selbst nicht direkt sichtbar** — wir kennen das `TaxEnvironmentCode`-Token, aber die zulässigen Tax-Codes erfahren wir erst über `orders/add`-Fehlermeldung (iteratives Testen).

**`AccountingConfiguration`** existiert — enthält Bank-/IBAN-/Surcharge-Config, irrelevant für Sprint C.

---

## A · `services/getAll` — 2 Types, 100 Services in Page 1

**Services-Anzahl in Page 1:** 100 (`Limitation.Count: 100`, Cursor wurde nicht ausgegeben → Page-2 ggf. weitere). Aktive + inaktive durchmischt.

**Eindeutige Service-Types:** **`Orderable`** und **`Reservable`** — exakt wie Brief vermutet hat.

**Roh-JSON erstes Service:**
```json
{
  "Id": "6cda24c8-c70e-46a1-ae5a-fdacf80aa3ee",
  "EnterpriseId": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
  "IsActive": false,
  "Name": "Trivec POS",
  "Names": { "en-US": "Trivec POS" },
  "StartTime": null,
  "EndTime": null,
  "Options": { "BillAsPackage": false },
  "Promotions": {
    "BeforeCheckIn": false, "AfterCheckIn": false, "DuringStay": false,
    "BeforeCheckOut": false, "AfterCheckOut": false, "DuringCheckOut": false
  },
  "Type": "Orderable",
  "Ordering": 0,
  "Data": {
    "Discriminator": "Additional",
    "Value": { "Promotions": {/* dupliziert */} }
  },
  "ExternalIdentifier": null,
  "CreatedUtc": "2017-10-13T12:37:40Z",
  "UpdatedUtc": "2019-08-26T11:43:14Z"
}
```

**Plausible Service-Kandidaten für unser MVP:**

| Booking-Typ | Mews-Service-Beispiele aus dem Demo |
|---|---|
| breakfast | `BB-Breakfast` (3956a6f3…), `Breakfast Voucher` (15ea4f49…), `Wedding Breakfast Food` (41666c07…) |
| service | `Room service 5%` (d6b9d417…), `Room service 20%` (0bcd98f1…), `Loundry` (e97c4e60…), `Washing and Drying Service` (5e431b44…) |
| conference | `Function Room Hire` (5e96e0fd…), `Wedding Room Hire` (05c2dd3e…), `Room rental` (5998087a…), `Mice Service` (13ac7699…) |

**Wichtige Felder pro Service:** `IsActive`, `Type`, `Names` (i18n-Hash), `Promotions` (zeitliche Verfügbarkeit), `Data.Discriminator` (z.B. `"Additional"` → klassischer Add-on-Service; vermutlich auch `"Accommodation"`/etc. für Reservable).

**Konsequenz für Sprint C:** **kein Auto-Match möglich**. Pro Hotel muss der Hotelier im Backoffice **eine Service-ID pro Booking-Typ wählen** (Dropdown aus `services/getAll`). Das ist semantisch sauber und nicht teurer als ein Auto-Match-Versuch der dann doch schief geht.

---

## B · `products/getAll` — 🔴 **NULL Products**

```
Top-Level-Keys: ['Products', 'CustomerProducts', 'Cursor']
Products-Anzahl: 0
CustomerProducts: 0
Cursor: (none)
```

**Das Demo-Hotel hat 0 Products** — auch ohne `ServiceIds`-Filter. Möglich dass Products an specific Services gebunden sind und nur mit Filter geliefert werden, aber mit dem broad Call kam **nichts**.

**Konsequenz Pfad C+ (Mews als Preis-Source-of-Truth):**
- Nicht testbar am Demo
- In echten Hotels existieren Products manchmal, manchmal nicht — Hotelier-abhängig
- Auch wenn sie existieren: pro Hotel müsste Hotelier ein Mapping pflegen (`breakfast_items.id → mews_product_id`)
- **Onboarding-Hürde ist hoch**, der MVP-Wert niedrig

**Empfehlung:** Pfad C+ verwerfen. Stattdessen **Custom-Items mit Preisen aus unserer DB** (Pfad A im Discovery-Bericht).

---

## C · `reservations/getAll` mit `Extent.Items: true` — **Items kommen nicht mit**

```
Request:  POST reservations/getAll/2023-06-06 mit Extent.Items=true, Extent.Customers=true
Response Top-Level-Keys: ['Reservations', 'Cursor']
Reservations: 5 · Items: 0 · Customers: 0
```

**Items + Customers fehlen komplett in der Response** — nicht `Items: []`, sondern die Properties existieren nicht. Mews ignoriert den Extent-Wunsch oder die Reservations haben tatsächlich keine Items.

Die geliefere Reservation (State=Started, also Gast ist eingecheckt) hat in den Top-Level-Keys **keine Item-Referenz** sichtbar:
```
Id, ServiceId, AccountId, AccountType, ..., StartUtc, EndUtc,
ActualStartUtc, ActualEndUtc, Purpose, QrCodeData, PersonCounts
```

**Konsequenz für „inkludiert"-Logik:** kann **nicht aus** `reservations/getAll` gezogen werden. Falls wir wissen wollen ob das Frühstück im Rate bereits inkludiert ist, müssten wir vermutlich `orders/getAll` mit der ReservationId aufrufen — das ist out-of-scope für Sprint C.

**Empfehlung:** „Inkludiert"-Erkennung verschieben. Für Sprint C einfach IMMER pushen, der Hotelier kann doppelte Charges in Mews manuell auflösen.

---

## Empfehlung — finale Sprint-C-Architektur

### Pfad-Entscheidung: **A (Preise in unserer DB) + Service-Mapping pro Hotel**

```
Unsere DB hält:
  · breakfast_items.price_cents       (NEU)
  · conference_rooms.price_cents_per_hour  (NEU, im JSON conference_rooms.conference_rooms-Array)
  · service_items.price_cents         (NEU, im JSON service_items-Array)

mews_integrations:
  · default_currency               TEXT  (aus config.Enterprise.Currencies[IsDefault], beim Connect)
  · default_tax_code               TEXT  (NULL initial, iterativ ermittelt beim ersten orders/add)
  · service_id_breakfast           UUID  (Hotelier wählt aus Orderable-Services)
  · service_id_conference          UUID  (dito)
  · service_id_service             UUID  (dito)
  · (kein default_service_id mehr — pro Booking-Typ separat)

bookings.mews_order_id   ✓ existiert
```

### Push-Logik (`orders/add` mit Custom Items)

```typescript
POST /orders/add {
  ServiceId: integration.service_id_<type>,
  AccountId: guest.mews_customer_id,
  LinkedReservationId: stay.mews_reservation_id,
  Items: [{
    Name: <sprechender Name aus details/lookup>,
    UnitCount: <people | duration_hours | 1>,
    UnitAmount: {
      Currency: integration.default_currency,
      NetValue: price_cents / 100,       // bei Pricing=Gross evtl. GrossValue stattdessen
      TaxCodes: [integration.default_tax_code]
    }
  }],
  ConsumptionUtc: <details.date + details.time>,
  Notes: `retaha booking #${booking.id}`
}
```

### Sprint-C-Ablauf (revidiert)

1. **Sprint C/1** — Client-Methoden `services/getAll` + `orders/add` in `src/lib/mews/client.ts` (typed)
2. **Sprint C/2** — Migration: `mews_integrations` um 4 Spalten + Preis-Spalten auf `breakfast_items` / hotel_settings JSON-Felder. Plus `mews_integrations.default_*` beim Connect setzen.
3. **Sprint C/3** — Backoffice-UI `/admin/pms`: Service-Mapping-Dropdowns (3 Stück, gefüllt aus `services/getAll`-Cache oder Live-Call)
4. **Sprint C/4** — Backoffice-UIs für Preise (breakfast/service/conference) — minimal: ein einzelnes price-Feld pro Item
5. **Sprint C/5** — Test-Script `orders/add` mit fester Reservation + 1 €/£-Item → TaxCode iterativ ermitteln (UK-2022)
6. **Sprint C/6** — Integration in `/api/bookings/update-status` (beim `→ confirmed` pushen, best-effort)
7. **Sprint C/7** — E2E-Test

### Offene Fragen für orders/add-Test (Sprint C/5)

1. **Gross vs Net:** Demo ist `Pricing=Gross` — akzeptiert `UnitAmount.NetValue`? Oder muss es `GrossValue` sein? Mews-Doku sagt: `UnitAmount` hat sowohl Net als auch Gross. Wir probieren NetValue zuerst.
2. **Tax-Code für UK-2022:** wahrscheinlich `"UK-S"` (Standard 20%) oder `"UK-V"` (5% reduced) — iterativ ermitteln.
3. **AccountingCategoryId:** im Demo wahrscheinlich nicht required. Erst ohne probieren.
4. **`ConsumptionUtc` in der Zukunft:** wir pushen evtl. `2026-05-30T08:00Z` (Frühstück morgen) — akzeptiert Mews zukünftige `ConsumptionUtc`?

---

## STOP

Bevor wir den revidierten Sprint C starten:

| # | Frage | Optionen |
|---|-------|----------|
| 1 | **Preis-Pfad bestätigt?** | Pfad A (DB-Preise + Custom-Items) — empfohlen / Pfad B (NetValue=0 Interim) / weiterhin C+ probieren |
| 2 | **Service-Mapping pro Booking-Typ?** | 3 separate `service_id_*`-Felder in `mews_integrations` (empfohlen) / 1 globales `default_service_id` |
| 3 | **„Inkludiert"-Detection?** | Sprint-C raus, immer pushen (empfohlen) / Mews-Side-Check über `orders/getAll` einbauen |
| 4 | **Probe-Script behalten?** | Nach Sprint-C-Abschluss löschen (analog `inspect:mews`-Pattern) / im Repo behalten für Demo-Debugging |

Plus: dieses Briefing-Dokument (`MEWS_PRODUCTS_PROBE.md`) + das Probe-Script in einem `chore(mews): probe-script + Befunde`-Commit?
