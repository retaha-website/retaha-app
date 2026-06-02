# Supabase Email-Templates Setup

> Die `auth.users`-Mails (Magic-Link, Email-Confirmation, Password-Reset) werden
> von Supabase selbst versendet, nicht von unserem Email-Stack (Microsoft 365 / Resend).
> Die HTML-Templates leben im Supabase Dashboard, nicht im Repo.
>
> Diese Dateien hier sind die **Quelle der Wahrheit** und werden ins Dashboard
> per Copy-Paste übertragen.

## Magic-Link-Template aktualisieren

Vorlage: [`supabase-magic-link.html`](./supabase-magic-link.html)

### Schritte im Supabase Dashboard

1. **Login** auf [supabase.com](https://supabase.com) → Projekt `retaha-app` auswählen
2. **Navigation:** `Authentication` (Schlüssel-Icon links) → `Email Templates`
3. **Tab:** `Magic Link` auswählen
4. **Subject** ändern auf:
   ```
   Dein Zugang zu retaha
   ```
5. **Message (HTML)** komplett ersetzen mit dem Inhalt aus
   [`supabase-magic-link.html`](./supabase-magic-link.html)
6. **Save** klicken — Supabase rendert das Template ab dem nächsten Magic-Link-Request

### Verfügbare Variables im Template

| Variable | Beschreibung |
|---|---|
| `{{ .ConfirmationURL }}` | Der Magic-Link selbst — bekommt Token + Redirect-URL |
| `{{ .Email }}` | Email-Adresse des Empfängers |
| `{{ .SiteURL }}` | Aus Supabase Settings → URL Configuration |
| `{{ .Token }}` | 6-stelliger Code (falls OTP statt Link) |
| `{{ .TokenHash }}` | Hashed Token |

### Test

1. Im Dashboard auf `Authentication` → `Users` → einen Test-User auswählen
   ODER unter [http://localhost:4321/admin/login](http://localhost:4321/admin/login)
   eine Test-Email eingeben + „Magic Link senden" klicken
2. Mail im Postfach (inkl. Spam) checken — Subject „Dein Zugang zu retaha",
   Pink-Akzent, „Anmelden →"-Button
3. Button-Klick → führt zu `/admin/auth/callback` → wenn Token gültig: eingeloggt

## Hinweis: Email-Sender

Supabase verschickt diese Mails standardmäßig über die eigene Sender-Infrastruktur
(`noreply@mail.app.supabase.io`). Für Production-Setup mit Custom-Sender:
`Authentication` → `Email Settings` → „Custom SMTP" konfigurieren (würde dann
unsere Microsoft 365 SMTP nutzen statt Supabase-Default).

Aktuell für den Pilot reicht der Supabase-Default-Sender, das Template ist
das Wichtige.
