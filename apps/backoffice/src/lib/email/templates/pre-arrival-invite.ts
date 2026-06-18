// Sprint D · Phase 6a — Pre-Arrival-Invite-Mail
// Premium-Look (kein Newsletter): persönliche Anrede, große Headline, eine
// klare CTA "App einrichten →". Inline-CSS für maximale Mail-Client-Kompatibilität.

export interface PreArrivalInviteData {
  hotelName: string;
  hotelLogoUrl?: string | null;
  hotelAccentColor?: string | null;
  guestFirstName: string | null;
  checkInLabel: string;  // pre-formatted "Mittwoch, 12. Juni 2026"
  checkOutLabel: string;
  pairUrl: string;       // https://retaha.de/api/pair?token=<jwt>
  addressForm?: 'du' | 'sie';  // guest_address_form — Default 'sie' (formal)
}

const ACCENT_FALLBACK = '#FF4A82';

export function preArrivalInviteSubject(data: PreArrivalInviteData): string {
  const name = data.guestFirstName ? ` ${data.guestFirstName}` : '';
  const formal = data.addressForm !== 'du';
  return `${formal ? 'Wir freuen uns auf Sie' : 'Wir freuen uns auf dich'}${name} — ${data.hotelName}`;
}

export function preArrivalInviteHtml(data: PreArrivalInviteData): string {
  const accent = data.hotelAccentColor ?? ACCENT_FALLBACK;
  const formal = data.addressForm !== 'du';
  const greeting = data.guestFirstName
    ? `Hallo ${escapeHtml(data.guestFirstName)},`
    : (formal ? `Schön, dass Sie kommen,` : `Schön, dass du kommst,`);
  const logoBlock = data.hotelLogoUrl
    ? `<img src="${escapeHtml(data.hotelLogoUrl)}" alt="${escapeHtml(data.hotelName)}" height="44" style="max-height:44px;display:block;border:0" />`
    : `<strong style="font-size:20px;color:#1A1A1A;letter-spacing:-0.01em">${escapeHtml(data.hotelName)}</strong>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(preArrivalInviteSubject(data))}</title>
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:48px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #eee">

      <!-- Header: Logo -->
      <tr><td align="left" style="padding:36px 40px 28px;border-bottom:1px solid #f0f0f0">
        ${logoBlock}
      </td></tr>

      <!-- Greeting + Headline -->
      <tr><td style="padding:40px 40px 8px">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.20em;text-transform:uppercase;color:${accent}">${formal ? 'Vor Ihrer Anreise' : 'Vor deiner Anreise'}</p>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.4">${greeting}</p>
        <h1 style="margin:0 0 18px;font-size:30px;font-weight:300;line-height:1.2;color:#1A1A1A;letter-spacing:-0.02em">
          wir freuen uns auf <strong style="font-weight:700">${formal ? 'Ihren' : 'deinen'} Aufenthalt</strong>.
        </h1>
      </td></tr>

      <!-- Stay-Range -->
      <tr><td style="padding:8px 40px 28px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.7;color:#1A1A1A">
          <tr>
            <td style="padding:8px 16px 8px 0;color:#777;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;width:90px;vertical-align:top">Anreise</td>
            <td style="padding:8px 0;color:#1A1A1A;font-size:15px;font-weight:500">${escapeHtml(data.checkInLabel)}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px 8px 0;color:#777;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;vertical-align:top">Abreise</td>
            <td style="padding:8px 0;color:#1A1A1A;font-size:15px;font-weight:500">${escapeHtml(data.checkOutLabel)}</td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:8px 40px 28px">
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#1A1A1A">
          ${formal
            ? 'Wir haben Ihnen eine kleine App vorbereitet — kein Download, kein Login, einfach auf Ihrem Handy. Mit ihr buchen Sie Frühstück, finden das WLAN und entdecken die Umgebung.'
            : 'Wir haben dir eine kleine App vorbereitet — kein Download, kein Login, einfach auf deinem Handy. Mit ihr buchst du Frühstück, findest das WLAN und entdeckst die Umgebung.'}
        </p>
        <a href="${escapeHtml(data.pairUrl)}"
           style="display:inline-block;padding:14px 28px;background:${accent};color:#fff;text-decoration:none;font-size:14px;font-weight:500;letter-spacing:0.04em">
          App einrichten →
        </a>
        <p style="margin:14px 0 0;font-size:11px;color:#999;line-height:1.5">
          Der Link funktioniert bis zu ${formal ? 'Ihrer' : 'deiner'} Anreise. Bei Fragen einfach antworten — wir lesen mit.
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 40px;border-top:1px solid #f0f0f0;background:#fafafa">
        <p style="margin:0;font-size:11px;color:#999;line-height:1.6">
          ${escapeHtml(data.hotelName)} · Diese Mail wurde automatisch vor ${formal ? 'Ihrer' : 'deiner'} Anreise versendet.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
