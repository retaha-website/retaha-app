// ACS Email-Sender für Marketing-Kampagnen.
// Nutzt ACS REST API direkt (kein SDK) mit HMAC-SHA256-Auth via Web-Crypto.
// ENV: ACS_CONNECTION_STRING, ACS_MAIL_FROM

export interface EmailSender {
  send(p: EmailSendParams): Promise<EmailSendResult>;
}

export interface EmailSendParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface EmailSendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export class AcsEmailSender implements EmailSender {
  constructor(private connectionString: string, private from: string) {}

  async send(p: EmailSendParams): Promise<EmailSendResult> {
    const endpoint = this.connectionString.match(/endpoint=([^;]+)/i)?.[1]?.replace(/\/$/, '');
    const accessKey = this.connectionString.match(/accesskey=([^;]+)/i)?.[1];
    if (!endpoint || !accessKey) return { ok: false, error: 'invalid_acs_connection_string' };

    const apiPath = '/emails:send';
    const query = 'api-version=2023-03-31';
    const url = `${endpoint}${apiPath}?${query}`;

    const body = JSON.stringify({
      senderAddress: this.from,
      recipients: { to: [{ address: p.to }] },
      content: { subject: p.subject, html: p.html },
      ...(p.replyTo ? { replyTo: [{ address: p.replyTo }] } : {}),
    });

    try {
      const headers = await this.buildAcsHeaders(endpoint, apiPath, query, 'POST', body, accessKey);
      const res = await fetch(url, { method: 'POST', headers, body });
      if (res.status === 202) {
        return { ok: true, id: res.headers.get('x-ms-request-id') ?? undefined };
      }
      const text = await res.text();
      return { ok: false, error: `acs_${res.status}: ${text.slice(0, 300)}` };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private async buildAcsHeaders(
    endpoint: string,
    path: string,
    query: string,
    method: string,
    body: string,
    accessKey: string,
  ): Promise<Record<string, string>> {
    const host = new URL(endpoint).hostname;
    const date = new Date().toUTCString();

    // SHA-256 of body → base64
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const contentHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

    // String-to-sign per ACS spec
    const stringToSign = `${method}\n${path}?${query}\n${date};${host};${contentHash}`;

    // HMAC-SHA256
    const keyBytes = Uint8Array.from(atob(accessKey), c => c.charCodeAt(0));
    const keyObj = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuffer = await crypto.subtle.sign('HMAC', keyObj, new TextEncoder().encode(stringToSign));
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    return {
      'Content-Type': 'application/json',
      'x-ms-date': date,
      'x-ms-content-sha256': contentHash,
      'host': host,
      'Authorization': `HMAC-SHA256 Credential=${accessKey}&SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    };
  }
}

// HTML-Builder für Marketing-Emails
export function buildMarketingEmailHtml(p: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl: string;
  trackingPixelUrl: string;
  hotelName: string;
}): string {
  const cta = p.ctaUrl
    ? `<div style="margin:28px 0;"><a href="${p.ctaUrl}" style="background:#8c2128;color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${p.ctaLabel ?? 'Mehr erfahren'}</a></div>`
    : '';
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${p.title}</title>
</head>
<body style="margin:0;padding:0;background:#f8f5f2;font-family:system-ui,-apple-system,sans-serif;">
<img src="${p.trackingPixelUrl}" width="1" height="1" alt="" style="display:block;height:1px;width:1px;margin:0;padding:0;border:0;" />
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="padding:36px 40px 0;">
    <h1 style="font-size:26px;font-weight:700;color:#1f1812;margin:0 0 20px;">${p.title}</h1>
    <div style="font-size:16px;line-height:1.7;color:#3d3530;">${p.body}</div>
    ${cta}
  </td></tr>
  <tr><td style="padding:24px 40px 36px;border-top:1px solid #ede8e3;">
    <p style="font-size:12px;color:#a09080;margin:0;line-height:1.5;">
      Diese E-Mail wurde von <strong>${p.hotelName}</strong> über retaha gesendet.<br>
      <a href="${p.unsubscribeUrl}" style="color:#a09080;text-decoration:underline;">E-Mails abbestellen</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
