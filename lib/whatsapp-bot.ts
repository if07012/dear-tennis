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
import { sendWahaText } from '@/lib/waha-client';
import { registerUserForActivity, type BookingUser } from '@/lib/activity-bookings';
import { getSkillPointsForUser } from '@/lib/user-skill-points-store';
import { getActivitiesContent } from '@/lib/activities-store';
import { SKILL_KEYS, SKILL_LABELS } from '@/data/user-skill-points-types';

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
    `Pendaftaran "${t}" sudah disetujui admin! Silakan lanjutkan pembayaran di website Dear Tennis ya. 🎾`,
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
 * Match a chat id to a member. Primary: exact users.waChatId — stamped when
 * the member OTP-verifies their number from the profile page, so formatting
 * can never cause a mismatch. Fallback: users.phone digit comparison
 * (legacy members who registered with a phone but never verified).
 */
async function resolveUserByPhone(chatId: string): Promise<BookingUser | null> {
  const spreadsheetId = getSpreadsheetId();
  console.log('resolveUserByPhone chatId:', chatId, 'spreadsheetId:', spreadsheetId);
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

/** Indonesian skill summary + open activity catalog for the system prompt. */
async function buildContext(user: BookingUser): Promise<string> {
  const [skillPoints, { activities }] = await Promise.all([
    getSkillPointsForUser(user.email),
    getActivitiesContent(),
  ]);

  const skills = skillPoints
    ? SKILL_KEYS.map(
      (k) => `${SKILL_LABELS[k]}: ${skillPoints.values[k]}/100`,
    ).join(', ')
    : 'Belum ada data skill (member belum pernah dinilai).';

  const weakest = skillPoints
    ? [...SKILL_KEYS].sort(
      (a, b) => skillPoints.values[a] - skillPoints.values[b],
    )[0]
    : null;

  const catalog = activities
    .filter((a) => a.archived !== true && a.isFull !== true)
    .map(
      (a) =>
        `- id=${a.id} | ${a.title} (${a.category}) | ${a.time || 'jadwal belum ditentukan'} | ${a.location || 'lokasi belum ditentukan'} | ${a.price || 'gratis'} | melatih: ${a.skillTags || 'umum'}`,
    )
    .join('\n');

  return [
    `Data skill member ${user.name} (rata-rata per skill): ${skills}`,
    weakest
      ? `Skill terlemah: ${SKILL_LABELS[weakest]} — prioritaskan rekomendasi activity yang melatih skill itu.`
      : 'Belum ada data skill, rekomendasikan activity umum.',
    `Daftar activity yang tersedia:\n${catalog || '(kosong)'}`,
  ].join('\n\n');
}

const SYSTEM_PROMPT = [
  'Kamu adalah asisten WhatsApp komunitas tenis "Dear Tennis".',
  'Balas selalu dalam Bahasa Indonesia, singkat dan ramah (maksimal ~120 kata).',
  'Tugasmu:',
  '1. Jawab pertanyaan member tentang progres latihan mereka berdasarkan data skill di bawah.',
  '2. Rekomendasikan activity dari daftar yang melatih skill terlemah member; sebut judul, jadwal, lokasi, dan harga.',
  '3. Jika member ingin mendaftar/booking suatu activity, lakukan pendaftaran: akhiri balasan dengan satu baris JSON berisi aksi booking, format persis: {"action":"book","activityId":"<id activity>"}',
  'Aturan penting:',
  '- Hanya gunakan activityId dari daftar yang diberikan; jangan mengarang id.',
  '- Baris JSON hanya ditulis sekali, di baris paling akhir, tanpa teks lain di baris itu.',
  '- Jika member hanya bertanya (bukan minta booking), JANGAN tulis JSON apa pun.',
  '- Jangan pernah membahas topik di luar tenis dan Dear Tennis; tolak dengan sopan.',
].join('\n');

/** Extract a trailing {"action":"book","activityId":"…"} line, if present. */
function parseBookingAction(reply: string): { activityId: string } | null {
  const lines = reply.trim().split('\n');
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    const line = lines[i]?.trim() ?? '';
    if (!line.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(line) as { action?: string; activityId?: string };
      if (parsed.action === 'book' && parsed.activityId) {
        return { activityId: String(parsed.activityId) };
      }
    } catch {
      // not JSON — keep scanning upward
    }
  }
  return null;
}

/**
 * Handle one incoming WhatsApp message end to end: log it, resolve the
 * sender, run one Groq call, book if the model asked to, send the reply.
 * Called fire-and-forget from the webhook route — never throws.
 */
export async function handleIncomingMessage(chatId: string, body: string): Promise<void> {
  try {
    await insertWaMessage({ chatId, userEmail: '', direction: 'in', body });
    console.log('handleIncomingMessage chatId:', chatId, 'body:', body);
    const user = await resolveUserByPhone(chatId);
    if (!user) {
      await sendWahaText(chatId, UNREGISTERED_REPLY);
      await insertWaMessage({
        chatId, userEmail: '', direction: 'out', body: UNREGISTERED_REPLY,
      });
      return;
    }

    const history = await listWaMessages(chatId, 8);
    const messages: GroqChatMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${await buildContext(user)}` },
      ...history.slice(0, -1).map((m) => ({
        role: (m.direction === 'out' ? 'assistant' : 'user') as GroqChatMessage['role'],
        content: m.body,
      })),
      { role: 'user', content: body },
    ];

    const reply = await callGroq(messages, chatId) ?? FALLBACK_REPLY;

    let finalReply = reply;
    const book = parseBookingAction(reply);
    if (book) {
      // Strip trailing JSON action lines from the visible text.
      finalReply = reply
        .trimEnd()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !l.startsWith('{'))
        .join('\n')
        .trimEnd();
      const result = await registerUserForActivity(user, book.activityId, {
        message: 'Booking via WhatsApp',
      });
      finalReply += result.ok
        ? result.created
          ? '\n\nBooking tercatat! Menunggu konfirmasi admin. Setelah disetujui, kamu akan menerima pesan selanjutnya di sini.'
          : '\n\nKamu sudah terdaftar di activity ini sebelumnya. Cek statusnya di website Dear Tennis.'
        : `\n\nMaaf, booking gagal: ${result.error}`;
    }

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
