// Microsoft 365 SMTP-Wrapper via Nodemailer.
// Service-Account: noreply@retaha.de (App-Passwort, MFA + Authenticated SMTP aktiv).
// SMTP: smtp.office365.com:587 mit STARTTLS.
//
// Best-Effort: bei Fehler console.warn + return { ok: false }, niemals throwen.
// Caller braucht keinen .catch — diese Funktion wirft nie.

import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv } from '@retaha/db';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;   // Display-Name vor <noreply@retaha.de>. z.B. "Gate Garden Hotel"
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

// Transporter lazy: cache nur bei Erfolg. Bei fehlenden ENVs jedes Mal
// retry — sonst bleibt der Wrapper auch nach Vite-HMR + .env-Edit auf null.
let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const host = getEnv('MICROSOFT_SMTP_HOST');
  const port = Number(getEnv('MICROSOFT_SMTP_PORT') ?? '587');
  const user = getEnv('MICROSOFT_SMTP_USER');
  const pass = getEnv('MICROSOFT_SMTP_PASSWORD');

  if (!host || !user || !pass || !Number.isFinite(port)) {
    const missing = [
      !host && 'MICROSOFT_SMTP_HOST',
      !user && 'MICROSOFT_SMTP_USER',
      !pass && 'MICROSOFT_SMTP_PASSWORD',
      !Number.isFinite(port) && 'MICROSOFT_SMTP_PORT (number)',
    ].filter(Boolean).join(', ');
    console.warn('[email] Microsoft SMTP env unvollständig — fehlt:', missing);
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,  // STARTTLS, nicht implicit TLS — Office 365 erwartet das auf 587
    auth: { user, pass },
    requireTLS: true,
  });
  return _transporter;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const transporter = getTransporter();
  if (!transporter) return { ok: false, error: 'no_smtp_config' };

  const senderUser = getEnv('MICROSOFT_SMTP_USER')!;  // garantiert da wenn transporter existiert
  const from = params.fromName
    ? `"${params.fromName.replace(/"/g, '\\"')}" <${senderUser}>`
    : senderUser;

  try {
    const info = await transporter.sendMail({
      from,
      to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.warn('[email] sendMail failed:', (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}
