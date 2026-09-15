// ============================================
// WHATSAPP BOT BRAIN — WAHA in → Groq → WAHA out
// ============================================
// PRD: chat-bot-mengguanakan-waha-pada-existing-tennis-community-export.md.
// Members ask about training progress, get activity recommendations that
// train their weakest skills, and book — all through the same
// registerUserForActivity pipeline as the website (pending_approval →
// admin confirms → payment → joined).

import { getSpreadsheetId, listRowsBySheet } from '@/app/lib/supabase';
import { callGroq, type GroqChatMessage } from '@/lib/groq-client';
import { insertWaMessage, listWaMessages } from '@/lib/groq-store';
import { sendWahaImage, sendWahaText } from '@/lib/waha-client';
import { approvalLink } from '@/lib/approval-token';
import { type BookingUser } from '@/lib/activity-bookings';
import { getActivitiesContent } from '@/lib/activities-store';
import {
  GROQ_TOOL_DEFS,
  hasPendingProof,
  runBotTool,
  stashPendingProof,
} from '@/lib/groq-tools';

const UNREGISTERED_REPLY =
  'Nomor WhatsApp kamu belum terverifikasi di Dear Tennis. ' +
  'Silakan login di website dear-tennis, isi nomor HP di halaman profil, ' +
  'lalu klik "Verifikasi nomor" (kami kirim kode OTP ke WhatsApp ini). ' +
  'Setelah terverifikasi, chat lagi di sini ya. 🎾';

const FALLBACK_REPLY =
  'Maaf, server sedang sibuk. Coba kirim pesan lagi beberapa saat lagi ya. 🎾';

/** "62812…@c.us" → "62812…" (digits only, keeps no @ suffix). */
function phoneFromChatId(chatId: string): string {
  return chatId.split('@')[0]?.replace(/\D/g, '') ?? '';
}

export type SignupDecisionKind =
  | 'approved'
  | 'rejected'
  | 'payment-approved'
  | 'payment-rejected';

const DECISION_MESSAGES: Record<SignupDecisionKind, (title: string) => string> = {
  approved: (t) =>
    `Pendaftaran "${t}" sudah disetujui admin! Silakan unggah bukti pembayaran di website Dear Tennis ya (buka activity-nya, lalu klik "Unggah Bukti Pembayaran"). 🎾`,
  rejected: (t) =>
    `Maaf, pendaftaran "${t}" tidak disetujui admin. Hubungi admin untuk info lebih lanjut. 🎾`,
  'payment-approved': (t) =>
    `Pembayaran "${t}" sudah terverifikasi. Kamu resmi tergabung! Sampai jumpa di lapangan! 🎾`,
  'payment-rejected': (t) =>
    `Maaf, bukti pembayaran "${t}" belum bisa diverifikasi. Silakan unggah ulang di website Dear Tennis. 🎾`,
};

/**
 * After an admin decision on a signup, notify the member over WhatsApp.
 * Silent no-op when the member has no phone on file or WAHA is down.
 */
export async function notifySignupDecision(
  userEmail: string,
  kind: SignupDecisionKind,
  activityId: string,
): Promise<void> {
  try {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return;
    const rows = await listRowsBySheet(spreadsheetId, 'users');
    const me = rows.find(
      (r) => String((r as { email?: unknown }).email ?? '').trim().toLowerCase() === userEmail,
    );
    // Prefer the OTP-verified chat id; fall back to the raw phone column.
    const waChatId = String((me as { waChatId?: unknown } | undefined)?.waChatId ?? '').trim();
    let phone = String((me as { phone?: unknown } | undefined)?.phone ?? '').replace(/\D/g, '');
    if (!waChatId && !phone) return;
    if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
    const chatId = waChatId || `${phone}@c.us`;

    const { activities } = await getActivitiesContent();
    const title = activities.find((a) => a.id === activityId)?.title ?? activityId;

    const text = DECISION_MESSAGES[kind](title);
    if (await sendWahaText(chatId, text)) {
      await insertWaMessage({
        chatId,
        userEmail,
        direction: 'out',
        body: text,
      });
    }
  } catch (error) {
    console.error('wa bot: failed to notify signup decision:', error);
  }
}

/**
 * Resolve the admin's WhatsApp chat id. ADMIN_WA_PHONE wins (digits get the
 * `@c.us` suffix; a full chat id is used as-is); when unset, fall back to
 * the users-table row behind ADMIN_EMAIL (waChatId, then phone).
 */
async function resolveAdminChatId(): Promise<string | null> {
  const configured = process.env.ADMIN_WA_PHONE?.trim();
  if (configured) {
    if (configured.includes('@')) return configured;
    const digits = configured.replace(/\D/g, '');
    if (digits) {
      return digits.startsWith('0') ? `62${digits.slice(1)}@c.us` : `${digits}@c.us`;
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return null;
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;
  const rows = await listRowsBySheet(spreadsheetId, 'users');
  const admin = rows.find(
    (r) => String((r as { email?: unknown }).email ?? '').trim().toLowerCase() === adminEmail,
  );
  const waChatId = String((admin as { waChatId?: unknown } | undefined)?.waChatId ?? '').trim();
  let phone = String((admin as { phone?: unknown } | undefined)?.phone ?? '').replace(/\D/g, '');
  if (!waChatId && !phone) return null;
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  return waChatId || `${phone}@c.us`;
}

/** Both approval messages end with the same one-click link block. */
function approvalLinksLine(signupId: string): string {
  const approve = approvalLink(signupId, 'approve');
  const reject = approvalLink(signupId, 'reject');
  if (!approve || !reject) return '';
  return `\n\nSetujui: ${approve}\nTolak: ${reject}`;
}

function paymentApprovalLinksLine(signupId: string): string {
  const approve = approvalLink(signupId, 'approve-payment');
  const reject = approvalLink(signupId, 'reject-payment');
  if (!approve || !reject) return '';
  return `\n\nVerifikasi pembayaran: ${approve}\nTolak pembayaran: ${reject}`;
}

/**
 * When a member's signup lands in pending_approval (website or bot), notify
 * the admin over WhatsApp with one-click approve/reject links. Silent no-op
 * when the admin target can't be resolved or WAHA is down.
 */
export async function notifyAdminNewSignup(
  userEmail: string,
  activityId: string,
  signupId: string,
): Promise<void> {
  try {
    const chatId = await resolveAdminChatId();
    if (!chatId) return;
    const [{ activities }, memberName] = await Promise.all([
      getActivitiesContent(),
      resolveUserName(userEmail),
    ]);
    const title = activities.find((a) => a.id === activityId)?.title ?? activityId;
    const text =
      `Pendaftaran baru dari ${memberName} untuk "${title}" — menunggu persetujuan.` +
      approvalLinksLine(signupId);
    if (await sendWahaText(chatId, text)) {
      await insertWaMessage({ chatId, userEmail: '', direction: 'out', body: text });
    }
  } catch (error) {
    console.error('wa bot: failed to notify admin new signup:', error);
  }
}

/** Display name for a member email; falls back to the email itself. */
async function resolveUserName(userEmail: string): Promise<string> {
  try {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return userEmail;
    const rows = await listRowsBySheet(spreadsheetId, 'users');
    const row = rows.find(
      (r) => String((r as { email?: unknown }).email ?? '').trim().toLowerCase() === userEmail,
    );
    return String((row as { name?: unknown } | undefined)?.name ?? '').trim() || userEmail;
  } catch {
    return userEmail;
  }
}

/**
 * When a member uploads payment proof (status → payment_submitted), notify
 * the admin over WhatsApp with the proof image attached. PDF proofs are sent
 * as a text mention instead (sendImage is images only). Silent no-op when the
 * admin has no phone on file or WAHA is down.
 */
export async function notifyPaymentSubmitted(
  userEmail: string,
  activityId: string,
  proofUrl: string,
  note?: string,
  signupId?: string,
): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'admin';
    const chatId = await resolveAdminChatId();
    if (!chatId) return;

    const [{ activities }, memberName] = await Promise.all([
      getActivitiesContent(),
      resolveUserName(userEmail),
    ]);
    const title = activities.find((a) => a.id === activityId)?.title ?? activityId;

    const text =
      `Bukti pembayaran baru dari ${memberName} untuk "${title}".` +
      (note ? ` Catatan: ${note}` : '') +
      (proofUrl.startsWith('data:application/pdf')
        ? ' Bukti berupa PDF — cek detailnya di dashboard admin Dear Tennis.'
        : '') +
      (signupId ? paymentApprovalLinksLine(signupId) : '');

    // Images go as sendImage with caption; PDFs (and send failures) fall back
    // to text so the admin always hears about the upload.
    if (!proofUrl.startsWith('data:application/pdf')) {
      if (await sendWahaImage(chatId, proofUrl, text)) {
        await insertWaMessage({ chatId, userEmail: adminEmail, direction: 'out', body: text });
        return;
      }
    }
    if (await sendWahaText(chatId, text)) {
      await insertWaMessage({ chatId, userEmail: adminEmail, direction: 'out', body: text });
    }
  } catch (error) {
    console.error('wa bot: failed to notify payment submitted:', error);
  }
}

/**
 * Match a chat id to a member. Primary: exact users.waChatId — stamped when
 * the member OTP-verifies their number from the profile page, so formatting
 * can never cause a mismatch. Fallback: users.phone digit comparison
 * (legacy members who registered with a phone but never verified).
 */
async function resolveUserByPhone(chatId: string): Promise<BookingUser | null> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;
  const rows = await listRowsBySheet(spreadsheetId, 'users');
  const userFromRow = (r: Record<string, unknown>): BookingUser | null => {
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!email) return null;
    return {
      id: String(r.id ?? ''),
      email,
      name: String(r.name ?? '').trim() || email,
    };
  };
  // Exact chat-id match (OTP-verified members).
  const byChatId = rows.find((r) => String(r.waChatId ?? '').trim() === chatId);
  if (byChatId) return userFromRow(byChatId);

  // Legacy fallback: compare digits.
  const digits = phoneFromChatId(chatId);
  if (!digits) return null;
  const normalise = (raw: unknown) => {
    let p = String(raw ?? '').replace(/\D/g, '');
    if (p.startsWith('0')) p = `62${p.slice(1)}`;
    return p;
  };
  for (const pass of ['exact', 'suffix'] as const) {
    for (const r of rows) {
      const phone = normalise((r as { phone?: unknown }).phone);
      if (!phone) continue;
      const hit = pass === 'exact' ? phone === digits : phone.endsWith(digits) || digits.endsWith(phone);
      if (!hit) continue;
      const user = userFromRow(r);
      if (user) return user;
    }
  }
  return null;
}

const SYSTEM_PROMPT = [
  'Kamu adalah asisten WhatsApp komunitas tenis "Dear Tennis".',
  'Balas selalu dalam Bahasa Indonesia, singkat dan ramah (maksimal ~120 kata).',
  'Member ini sudah terverifikasi: kamu bisa memakai tools untuk mengambil data pribadinya',
  '(activity, skill, performance, hasil pertandingan, achievements, status pendaftaran),',
  'merekomendasikan activity, atau melakukan aksi (booking, kirim bukti pembayaran,',
  'pembatalan) atas permintaan member.',
  'Aturan penting:',
  '- Untuk pertanyaan data pribadi atau daftar activity, selalu panggil tool yang sesuai dulu — jangan mengarang data.',
  '- activityId/signupId hanya boleh berasal dari hasil tool sebelumnya.',
  '- JANGAN pernah menampilkan activityId atau signupId (atau id teknis lain) di pesan balasan ke member — id hanya untuk memanggil tool secara internal.',
  '- Jika member mengirim gambar bukti pembayaran, panggil submit_payment_proof (cek signupId lewat get_my_signups bila perlu).',
  '- Jangan pernah membahas topik di luar tenis dan Dear Tennis; tolak dengan sopan.',
  '- Format pesan WA: JANGAN pakai tabel markdown (tidak tampil di WhatsApp).',
  '  Untuk daftar, pakai bullet/poin per baris atau nomor, satu activity per baris',
  '  dengan jadwal, lokasi, dan harga setelah judulnya. Hindari juga heading (#)',
  '  dan tautan markdown — gunakan teks polos dengan *bold* bila perlu.',
].join('\n');

/** One assistant turn: text, tool calls, or both. */
type Turn = { text: string | null; toolCalls: { id: string; name: string; args: unknown }[] };

/** Run one Groq round, normalizing the reply shape. Never throws. */
async function groqTurn(messages: GroqChatMessage[], chatId: string): Promise<Turn> {
  try {
    const result = await callGroq(messages, chatId, GROQ_TOOL_DEFS, 'auto');
    return {
      text: result.text,
      toolCalls: result.toolCalls.map((tc) => {
        let args: unknown = {};
        try {
          console.log('wa bot: groq tool call:', tc.function.name, tc.function.arguments);
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }
        return { id: tc.id, name: tc.function.name, args };
      }),
    };
  } catch (error) {
    console.error('wa bot: groq turn failed:', error);
    return { text: null, toolCalls: [] };
  }
}

/**
 * Handle one incoming WhatsApp media message: stash it as a pending payment
 * proof for the chat and confirm receipt. Called fire-and-forget — never
 * throws.
 */
export async function handleIncomingMedia(
  chatId: string,
  mimetype: string,
  base64: string,
): Promise<void> {
  try {
    await insertWaMessage({
      chatId,
      userEmail: '',
      direction: 'in',
      body: `[bukti pembayaran terlampir: ${mimetype}]`,
    });
    stashPendingProof(chatId, {
      dataUrl: `data:${mimetype};base64,${base64}`,
      mimetype,
      receivedAt: Date.now(),
    });
    await sendWahaText(
      chatId,
      'Bukti pembayaran diterima! Balas pesan ini untuk memberi tahu pendaftaran mana yang dibayar — sebutkan judul activity-nya ya. 🎾',
    );
  } catch (error) {
    console.error('wa bot: failed to handle incoming media:', error);
  }
}

/**
 * Handle one incoming WhatsApp message end to end: log it, resolve the
 * sender, run one Groq call, book if the model asked to, send the reply.
 * Called fire-and-forget from the webhook route — never throws.
 */
export async function handleIncomingMessage(chatId: string, body: string): Promise<void> {
  try {
    await insertWaMessage({ chatId, userEmail: '', direction: 'in', body });
    const user = await resolveUserByPhone(chatId);
    if (!user) {
      await insertWaMessage({
        chatId, userEmail: '', direction: 'out', body: UNREGISTERED_REPLY,
      });
      return;
    }

    const history = await listWaMessages(chatId, 8);
    // Surface a stashed payment proof so the model knows it can attach one.
    const userLine = hasPendingProof(chatId)
      ? `${body}\n\n[Member baru saja mengirim file bukti pembayaran di chat ini — belum diproses]`
      : body;
    const messages: GroqChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(0, -1).map((m) => ({
        role: (m.direction === 'out' ? 'assistant' : 'user') as GroqChatMessage['role'],
        content: m.body,
      })),
      { role: 'user', content: userLine },
    ];

    // Agentic loop, bounded: keep executing tool calls and feeding results
    // back until the model answers in text (or the round cap hits).
    // ponytail: cap 3 rounds — raise if models legitimately chain that far.
    let finalText: string | null = null;
    for (let round = 0; round < 3 && finalText === null; round++) {
      const turn = await groqTurn(messages, chatId);
      if (turn.toolCalls.length === 0) {
        finalText = turn.text;
        break;
      }
      messages.push({
        role: 'assistant',
        content: turn.text,
        tool_calls: turn.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
        })),
      });
      for (const tc of turn.toolCalls) {
        const result = await runBotTool(user, chatId, tc.name, (tc.args ?? {}) as Record<string, unknown>);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      if (turn.text !== null) finalText = turn.text;
    }

    const finalReply = finalText ?? FALLBACK_REPLY;
    const sent = await sendWahaText(chatId, finalReply);
    if (sent) {
      await insertWaMessage({
        chatId, userEmail: user.email, direction: 'out', body: finalReply,
      });
    }
  } catch (error) {
    console.error('wa bot: failed to handle incoming message:', error);
    await sendWahaText(chatId, FALLBACK_REPLY).catch(() => undefined);
  }
}
