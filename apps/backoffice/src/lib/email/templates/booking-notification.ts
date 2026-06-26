// Plain-HTML Email-Template für Hotelier-Notifications bei neuen Buchungen.
// Bewusst kein Email-Framework — einfaches Inline-CSS für maximale Client-Kompatibilität.

export interface BookingNotificationData {
  hotelName: string;
  hotelLogoUrl?: string | null;
  hotelAccentColor?: string | null;
  /** First-Name des Hotel-Owners für "Hallo Kristin," — null = neutrale Anrede */
  recipientFirstName?: string | null;
  guestName: string;
  roomLabel?: string | null;
  bookingType: 'breakfast' | 'service';
  scheduledFor?: string | null;  // Pre-Formatted Datum/Zeit, z.B. "morgen 08:00"
  detailsSummary?: string | null;  // z.B. "2 Personen · innen"
  backofficeUrl: string;          // Link zu /admin/bookings (oder /admin/bookings/[id])
}

const TYPE_LABELS: Record<string, string> = {
  breakfast: 'Frühstück',
  service: 'Service-Anfrage',
};

export function bookingNotificationSubject(data: BookingNotificationData): string {
  const typeLabel = TYPE_LABELS[data.bookingType] ?? data.bookingType;
  return `${data.hotelName} · Neue ${typeLabel} von ${data.guestName}`;
}

export function bookingNotificationHtml(data: BookingNotificationData): string {
  const typeLabel = TYPE_LABELS[data.bookingType] ?? data.bookingType;
  const accent = data.hotelAccentColor ?? '#FF4A82';
  const logoBlock = data.hotelLogoUrl
    ? `<img src="${escapeHtml(data.hotelLogoUrl)}" alt="${escapeHtml(data.hotelName)}" height="40" style="max-height:40px;display:block;border:0" />`
    : `<strong style="font-size:18px;color:#1A1A1A">${escapeHtml(data.hotelName)}</strong>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(bookingNotificationSubject(data))}</title>
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #eee">
      <tr><td style="padding:28px 32px 16px;border-bottom:1px solid #f0f0f0">
        ${logoBlock}
      </td></tr>
      <tr><td style="padding:28px 32px 8px">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accent}">Neue Buchung</p>
        ${data.recipientFirstName
          ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.4;color:#1A1A1A">Hallo ${escapeHtml(data.recipientFirstName)},</p>`
          : ''}
        <h1 style="margin:0 0 18px;font-size:22px;font-weight:300;line-height:1.3;color:#1A1A1A">
          ${escapeHtml(typeLabel)} von <strong style="font-weight:700">${escapeHtml(data.guestName)}</strong>
        </h1>
      </td></tr>
      <tr><td style="padding:0 32px 8px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.7;color:#1A1A1A">
          ${row('Typ', escapeHtml(typeLabel))}
          ${data.roomLabel ? row('Zimmer', escapeHtml(data.roomLabel)) : ''}
          ${data.scheduledFor ? row('Termin', escapeHtml(data.scheduledFor)) : ''}
          ${data.detailsSummary ? row('Details', escapeHtml(data.detailsSummary)) : ''}
          ${row('Status', 'wartet auf Bestätigung')}
        </table>
      </td></tr>
      <tr><td style="padding:24px 32px 32px">
        <a href="${escapeHtml(data.backofficeUrl)}"
           style="display:inline-block;padding:12px 24px;background:${accent};color:#fff;text-decoration:none;font-size:14px;font-weight:500;letter-spacing:0.04em">
          Im Backoffice ansehen →
        </a>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f0f0f0;background:#fafafa">
        <p style="margin:0;font-size:11px;color:#777;line-height:1.6">
          Du erhältst diese Email weil deine Adresse als Benachrichtigungs-Email in retaha hinterlegt ist.
          Anpassen unter <a href="${escapeHtml(data.backofficeUrl.replace(/\/admin\/.*$/, '/admin/settings'))}" style="color:${accent}">Einstellungen</a>.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 0;color:#777;font-size:13px;width:100px;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:4px 0;color:#1A1A1A;font-size:14px">${value}</td>
  </tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
