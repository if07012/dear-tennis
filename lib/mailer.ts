// ============================================
// MAILER — Brevo SMTP transport
// ============================================
// Thin wrapper around nodemailer configured for Brevo's transactional SMTP
// relay. The transport is built lazily so that the absence of credentials
// during local dev doesn't crash the module import.
//
// Environment variables (configure in .env / .env.local):
//   BREVO_SMTP_HOST     default: smtp-relay.brevo.com
//   BREVO_SMTP_PORT     default: 587
//   BREVO_SMTP_USER     e.g. "98xxx001@smtp-brevo.com"
//   BREVO_SMTP_PASS     SMTP key from Brevo dashboard
//   MAIL_FROM           e.g. "Dear Tennis <hello@dear-tennis.com>"
//   NEXT_PUBLIC_SITE_URL  used to build absolute invite links

import nodemailer, { type Transporter } from 'nodemailer';

let cachedTransport: Transporter | null = null;

type MailerConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  siteUrl: string;
};

function readConfig(): MailerConfig | null {
  const user = process.env.BREVO_SMTP_USER?.trim();
  const pass = process.env.BREVO_SMTP_PASS?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!user || !pass || !from) return null;

  const host = process.env.BREVO_SMTP_HOST?.trim() || 'smtp-relay.brevo.com';
  const portRaw = process.env.BREVO_SMTP_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 587;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
    'http://localhost:3000';

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    user,
    pass,
    from,
    siteUrl,
  };
}

export function isMailerConfigured(): boolean {
  return readConfig() !== null;
}

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;
  const cfg = readConfig();
  if (!cfg) {
    throw new Error(
      'Brevo SMTP is not configured. Set BREVO_SMTP_USER, BREVO_SMTP_PASS, and MAIL_FROM.',
    );
  }
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return cachedTransport;
}

export type InviteEmailInput = {
  to: string;
  name?: string;
  message?: string;
  inviteToken: string;
};

/**
 * Send the membership invitation email. Returns the Brevo messageId on
 * success. Throws on failure — caller decides whether to surface the error
 * to the admin or fall back to a "pending" invite row.
 */
export async function sendInviteEmail(
  input: InviteEmailInput,
): Promise<string> {
  const cfg = readConfig();
  if (!cfg) {
    throw new Error('Brevo SMTP is not configured.');
  }

  const inviteUrl = `${cfg.siteUrl}/invite/${input.inviteToken}`;
  const greeting = input.name ? `Hi ${input.name},` : 'Hi,';
  const personalNote = input.message
    ? `<p style="margin:16px 0;padding:14px 18px;border-left:3px solid #E85D04;background:#FFF5EE;border-radius:6px;white-space:pre-wrap;">${escapeHtml(input.message)}</p>`
    : '';

  const subject = "You're invited to Dear Tennis";
  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2a24;">
      <h1 style="font-family:Georgia,serif;color:#2C5F4B;margin:0 0 8px;">Dear Tennis</h1>
      <p style="margin:0 0 16px;color:#2C5F4B;font-size:14px;letter-spacing:0.18em;text-transform:uppercase;">Membership Invitation</p>
      <p style="font-size:16px;line-height:1.6;">${escapeHtml(greeting)}</p>
      <p style="font-size:16px;line-height:1.6;">
        You've been invited to join the Dear Tennis community. We'd love to
        have you on the court with us.
      </p>
      ${personalNote}
      <p style="margin:24px 0 8px;font-size:14px;">Activate your invitation:</p>
      <p style="margin:0 0 24px;">
        <a href="${inviteUrl}" style="display:inline-block;background:#E85D04;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
          Join Dear Tennis
        </a>
      </p>
      <p style="font-size:12px;color:#6b6b6b;">
        Or copy this link: <br />
        <a href="${inviteUrl}" style="color:#2C5F4B;word-break:break-all;">${inviteUrl}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:12px;color:#6b6b6b;margin:0;">
        If you weren't expecting this invitation you can safely ignore this
        email.
      </p>
    </div>
  `;
  const text = [
    'Dear Tennis — Membership Invitation',
    '',
    greeting.replace(',', ','),
    '',
    "You've been invited to join the Dear Tennis community.",
    input.message ? `\nMessage from the inviter:\n${input.message}\n` : '',
    `Activate your invitation: ${inviteUrl}`,
    '',
    "If you weren't expecting this invitation you can safely ignore this email.",
  ]
    .filter(Boolean)
    .join('\n');

  console.log(`[mailer] Sending invite email to ${input.to}...`);
  const transport = getTransport();
  console.log(`[mailer] Using SMTP host=${cfg.host} port=${cfg.port} user=${cfg.user}`);
  const info = await transport.sendMail({
    from: cfg.from,
    to: input.to,
    subject,
    html,
    text,
  });
  console.log(`[mailer] Sent invite email to ${input.to}, messageId=${info.messageId}`);
  return info.messageId ?? '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}