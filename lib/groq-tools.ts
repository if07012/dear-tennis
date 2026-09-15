// ============================================
// GROQ BOT TOOLS — OpenAI-style tool defs + in-process executors
// ============================================
// PRD: add-tools-in-groq-to-read-existing-api-export.md. The WhatsApp bot's
// Groq call sends these definitions; when the model returns tool_calls, the
// bot executes them here — directly against the existing stores, no HTTP
// layer (the PRD's REST endpoints assumed Groq calls us; here we call Groq).
//
// Security: every tool acts as the chat-id-resolved BookingUser. The model
// never supplies the identity — activityId/signupId are the only
// member-controlled inputs, and signup tools re-check row ownership.

import { getSpreadsheetId, listRowsBySheet } from '@/app/lib/supabase';
import type { GroqToolDef } from '@/lib/groq-client';
import {
  registerUserForActivity,
  type BookingUser,
} from '@/lib/activity-bookings';
import {
  cancelSignup,
  submitPaymentProof,
} from '@/lib/activity-signups-store';
import { getActivitiesContent, type ActivityCategory } from '@/lib/activities-store';
import { getSkillPointsForUser } from '@/lib/user-skill-points-store';
import {
  getPerformanceForUser,
  listAllUserPerformance,
} from '@/lib/user-performance-store';
import { listGrantedBadgesForUser } from '@/lib/achievements-store';
import { listMatchesForActivity, type MatchRecord } from '@/app/lib/matches-store';
import { notifyPaymentSubmitted } from '@/lib/whatsapp-bot';
import { SKILL_KEYS, SKILL_LABELS } from '@/data/user-skill-points-types';

export const GROQ_TOOL_DEFS: GroqToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_upcoming_activities',
      description:
        'Ambil daftar activity/latihan tenis yang tersedia (tidak diarsip, belum penuh), lengkap dengan jadwal, lokasi, harga, dan skill yang dilatih. Hasil dipaginasi 5 per panggilan — bila hasMore true dan member minta "lainnya", panggil lagi dengan offset dari nextOffset.',
      parameters: {
        type: 'object',
        properties: {
          offset: { type: 'number', description: 'Mulai dari index ini (default 0)' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_activities',
      description:
        'Cari activity berdasarkan nama (case-insensitive, sebagian kata cocok). Hasil lengkap dengan jadwal, lokasi, harga, dan status (termasuk yang archived/penuh — untuk info, bukan pendaftaran). Dipaginasi 5 per panggilan — bila hasMore true dan member minta "lainnya", panggil lagi dengan query sama + offset dari nextOffset.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Kata kunci nama activity' },
          offset: { type: 'number', description: 'Mulai dari index ini (default 0)' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_activities_by_category',
      description:
        'Cari activity berdasarkan kategori: training, social, atau competitive. Terima juga sebutan awam member — coaching/coach/latihan → training, fun match/funmatch/mabar/turnamen/turnamen → competitive, main santai → social. Mapping dilakukan otomatis. Dipaginasi 5 per panggilan — bila hasMore true dan member minta "lainnya", panggil lagi dengan kategori sama + offset dari nextOffset.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'training | social | competitive (atau sebutan awam seperti coaching, fun match, mabar)',
          },
          offset: { type: 'number', description: 'Mulai dari index ini (default 0)' },
        },
        required: ['category'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_skills',
      description:
        'Ambil data skill tenis member (forehand, backhand, serve, volley, footwork, strategy) — nilai rata-rata 0-100 beserta sub-stat. Kosong bila member belum pernah dinilai.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_performance',
      description:
        'Ambil data performance member: target dan jumlah kesalahan per skill. Bisa difilter per activity.',
      parameters: {
        type: 'object',
        properties: {
          activityId: { type: 'string', description: 'Opsional: filter per activity' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_achievements',
      description: 'Ambil badge/achievement yang sudah diraih member.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_matches',
      description:
        'Ambil riwayat hasil pertandingan member (funmatch/turnamen): skor per set, menang/kalah, lawan.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_activities',
      description:
        'Rekomendasikan activity yang melatih skill terlemah member (berdasarkan data skill terbaru).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_signups',
      description:
        'Ambil daftar pendaftaran activity member beserta status (pending_approval, waiting_payment, payment_submitted, joined, cancelled, rejected, expired), jumlah bayar, dan id pendaftaran (signupId).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_activity',
      description:
        'Daftarkan member ke sebuah activity (pakai activityId dari get_upcoming_activities). Hasil: pendaftaran baru berstatus pending_approval, menunggu persetujuan admin.',
      parameters: {
        type: 'object',
        properties: {
          activityId: { type: 'string', description: 'id activity dari katalog' },
        },
        required: ['activityId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_payment_proof',
      description:
        'Lampirkan bukti pembayaran (gambar/PDF yang barusan dikirim member di chat ini) ke pendaftaran berstatus waiting_payment. Gunakan signupId dari get_my_signups.',
      parameters: {
        type: 'object',
        properties: {
          signupId: { type: 'string', description: 'id pendaftaran' },
          note: { type: 'string', description: 'Opsional: catatan, mis. nomor referensi' },
        },
        required: ['signupId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_signup',
      description:
        'Batalkan pendaftaran member (hanya status aktif: pending_approval, waiting_payment, payment_submitted, joined).',
      parameters: {
        type: 'object',
        properties: {
          signupId: { type: 'string', description: 'id pendaftaran' },
          reason: { type: 'string', description: 'Opsional: alasan pembatalan' },
        },
        required: ['signupId'],
        additionalProperties: false,
      },
    },
  },
];

/** Human-readable status labels for the model. */
const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'menunggu persetujuan admin',
  waiting_payment: 'menunggu pembayaran',
  payment_submitted: 'bukti pembayaran sedang diverifikasi',
  joined: 'sudah bergabung',
  rejected: 'ditolak admin',
  cancelled: 'dibatalkan',
  expired: 'kedaluwarsa',
};

/** Serialize one activity for tool results. */
function activityView(a: {
  id: string;
  title: string;
  category: string;
  time: string;
  location: string;
  price?: string;
  duration: string;
  groupSize: string;
  skillTags?: string;
}) {
  return {
    // Internal id — the model uses it for book_activity but must NEVER
    // print it in the WhatsApp reply (see SYSTEM_PROMPT).
    activityId: a.id,
    title: a.title,
    category: a.category,
    schedule: a.time || 'belum ditentukan',
    location: a.location || 'belum ditentukan',
    price: a.price || 'gratis',
    duration: a.duration,
    groupSize: a.groupSize,
    trainsSkills: a.skillTags || 'umum',
  };
}

/** Page info appended to paginated list results — drives "load more". */
const PAGE_SIZE = 5;

function paginated<T>(items: T[], offset: number) {
  const page = items.slice(offset, offset + PAGE_SIZE);
  return {
    activities: page,
    total: items.length,
    offset,
    hasMore: offset + page.length < items.length,
    nextOffset: offset + page.length,
    note:
      offset + page.length < items.length
        ? `Masih ada ${items.length - offset - page.length} activity lagi. Beri tahu member bisa minta "lainnya/lanjut" — panggil tool yang sama dengan offset ${offset + page.length}.`
        : undefined,
  };
}

/** Score string from per-set scores, winner-perspective of `viewerOnA`. */
function scoreString(m: MatchRecord, viewerOnA: boolean): string {
  const pairs: Array<[number | null, number | null]> = [
    [m.set1A, m.set1B],
    [m.set2A, m.set2B],
    [m.set3A, m.set3B],
  ];
  const sets = pairs
    .filter(([x, y]) => (x ?? 0) > 0 || (y ?? 0) > 0)
    .map(([x, y]) =>
      viewerOnA ? `${x}-${y}` : `${y}-${x}`,
    );
  return sets.join(', ') || '-';
}

/** Viewer-perspective projection of matches the member played in. */
async function myMatches(user: BookingUser) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { matches: [] as unknown[] };

  const email = user.email.trim().toLowerCase();
  const [signupRows, { activities }] = await Promise.all([
    listRowsBySheet(spreadsheetId, 'activity_signups'),
    getActivitiesContent(),
  ]);
  const titles = new Map(activities.map((a) => [a.id, a.title]));

  // Joined activities = the matches the member could have played in.
  const joinedIds = new Set(
    signupRows
      .map((raw) => raw as unknown as Record<string, unknown>)
      .filter((r) => String(r.userEmail ?? '').trim().toLowerCase() === email)
      .filter((r) => {
        const st = String(r.status ?? '');
        return st === 'joined' || st === 'approved';
      })
      .map((r) => String(r.activityId ?? '').trim())
      .filter(Boolean),
  );

  const out: unknown[] = [];
  for (const activityId of joinedIds) {
    const stored = await listMatchesForActivity(spreadsheetId, activityId).catch(
      () => [] as MatchRecord[],
    );
    for (const m of stored) {
      const a = m.sideA.split(',').map((s) => s.trim()).filter(Boolean);
      const b = m.sideB.split(',').map((s) => s.trim()).filter(Boolean);
      const viewerOnA = a.includes(email);
      const viewerOnB = b.includes(email);
      if (!viewerOnA && !viewerOnB) continue;
      const oppSide = viewerOnA ? b : a;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (m.winner === 'A') result = viewerOnA ? 'win' : 'loss';
      else if (m.winner === 'B') result = viewerOnA ? 'loss' : 'win';
      out.push({
        activityId,
        activity: titles.get(activityId) ?? activityId,
        score: scoreString(m, viewerOnA),
        result,
        isDoubles: m.isDoubles,
        opponent: oppSide.filter((e) => e !== email).join(' & ') || '-',
      });
    }
  }
  return { matches: out };
}

/** Case-insensitive title search across all activities. */
async function searchActivities(query: string, offset = 0) {
  const q = query.trim().toLowerCase();
  if (!q) return { activities: [], note: 'Query kosong.' };
  const { activities } = await getActivitiesContent();
  const hits = activities
    .filter((a) => a.title.toLowerCase().includes(q))
    .map((a) => ({
      ...activityView(a),
      archived: a.archived === true,
      full: a.isFull === true,
    }));
  return paginated(hits, offset);
}

/**
 * Member slang → category. "coaching" = training, "fun match"/"mabar" =
 * competitive. Substring match on the alias list, so "pelatihan" hits
 * "latihan" via the alias itself; extend the list as members coin terms.
 */
const CATEGORY_ALIASES: Record<ActivityCategory, string[]> = {
  training: ['training', 'coaching', 'coach', 'latihan', 'kelas', 'les'],
  social: ['social', 'santai', 'main santai', 'casual'],
  competitive: ['competitive', 'competitve', 'fun match', 'funmatch', 'mabar', 'main bareng', 'turnamen', 'tournament', 'match', 'lomba'],
};

function mapCategoryKeyword(raw: string): ActivityCategory | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  for (const key of ['training', 'social', 'competitive'] as const) {
    if (q === key || CATEGORY_ALIASES[key].some((a) => q.includes(a) || a.includes(q))) {
      return key;
    }
  }
  return null;
}

/** Category search with slang mapping — mirrors searchActivities output. */
async function searchActivitiesByCategory(categoryInput: string, offset = 0) {
  const mapped = mapCategoryKeyword(categoryInput);
  if (!mapped) {
    return {
      error:
        `Kategori tidak dikenali: "${categoryInput}". Gunakan training, social, atau competitive (atau sebutan seperti coaching, fun match, mabar).`,
    };
  }
  const { activities } = await getActivitiesContent();
  const hits = activities
    .filter((a) => a.category === mapped)
    .map((a) => ({
      ...activityView(a),
      archived: a.archived === true,
      full: a.isFull === true,
    }));
  return { category: mapped, ...paginated(hits, offset) };
}

/** Ordered skill-gap recommendation: weakest skill first, tagged activities. */
async function recommendations(user: BookingUser) {
  const [skills, { activities }] = await Promise.all([
    getSkillPointsForUser(user.email),
    getActivitiesContent(),
  ]);
  const open = activities.filter((a) => a.archived !== true && a.isFull !== true);

  if (!skills) {
    return {
      recommendations: open.slice(0, 5).map((a) => ({
        ...activityView(a),
        reason: 'Belum ada data skill — activity umum.',
      })),
    };
  }

  const weakest = [...SKILL_KEYS].sort(
    (a, b) => skills.values[a] - skills.values[b],
  );
  const out: unknown[] = [];
  // Skills actually covered by at least one open activity — the model must
  // only mention these, never a weaker-but-uncovered skill.
  const coveredSkills: string[] = [];
  for (const skill of weakest) {
    const label = SKILL_LABELS[skill];
    const matches = open.filter((a) =>
      (a.skillTags ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .includes(skill),
    );
    if (matches.length > 0) coveredSkills.push(label);
    for (const a of matches) {
      out.push({
        ...activityView(a),
        reason: `Melatih ${label} (nilai kamu ${skills.values[skill]}/100)`,
      });
    }
    if (out.length >= 5) break;
  }
  if (out.length === 0) {
    return {
      recommendations: [],
      coveredSkills: [],
      note: 'Tidak ada activity terbuka yang melatih skill terlemah member. Jangan sebut skill apa pun sebagai rekomendasi.',
    };
  }
  return { recommendations: out, coveredSkills };
}

/** Trimmed per-user signup list — gives the model the signupId it needs. */
async function mySignups(user: BookingUser) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { signups: [] as unknown[] };
  const email = user.email.trim().toLowerCase();
  const [{ activities }, rows] = await Promise.all([
    getActivitiesContent(),
    listRowsBySheet(spreadsheetId, 'activity_signups'),
  ]);
  const titles = new Map(activities.map((a) => [a.id, a.title]));
  const mine = rows
    .map((raw) => raw as unknown as Record<string, unknown>)
    .filter((r) => String(r.userEmail ?? '').trim().toLowerCase() === email)
    .map((r) => {
      const activityId = String(r.activityId ?? '').trim();
      return {
        signupId: String(r.id ?? '').trim(),
        activityId,
        activity: titles.get(activityId) ?? activityId,
        status: String(r.status ?? ''),
        statusLabel:
          STATUS_LABELS[String(r.status ?? '')] ?? String(r.status ?? ''),
        amount: Number(r.finalAmount ?? 0) || 0,
        expiresAt: r.expiresAt ? String(r.expiresAt) : undefined,
        rejectionReason: r.rejectionReason ? String(r.rejectionReason) : undefined,
      };
    })
    .filter((s) => s.signupId && s.activityId);
  return { signups: mine };
}

/** Pending payment-proof media stashed by the webhook (see whatsapp-bot). */
export type PendingProof = { dataUrl: string; mimetype: string; receivedAt: number };
const PENDING_TTL_MS = 10 * 60 * 1000;

const stash = globalThis as unknown as {
  __bot_pending_proofs__?: Map<string, PendingProof>;
};
const pendingProofs: Map<string, PendingProof> = (stash.__bot_pending_proofs__ ??=
  new Map());

export function stashPendingProof(chatId: string, proof: PendingProof) {
  pendingProofs.set(chatId, proof);
}

export function takePendingProof(chatId: string): PendingProof | null {
  const hit = pendingProofs.get(chatId);
  if (!hit) return null;
  if (Date.now() - hit.receivedAt > PENDING_TTL_MS) {
    pendingProofs.delete(chatId);
    return null;
  }
  pendingProofs.delete(chatId);
  return hit;
}

export function hasPendingProof(chatId: string): boolean {
  const hit = pendingProofs.get(chatId);
  if (!hit) return false;
  if (Date.now() - hit.receivedAt > PENDING_TTL_MS) {
    pendingProofs.delete(chatId);
    return false;
  }
  return true;
}

/**
 * Execute one bot tool. Never throws — errors come back as { error } for the
 * model to relay. `args` is the parsed JSON arguments object.
 */
export async function runBotTool(
  user: BookingUser,
  chatId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    switch (name) {
      case 'get_upcoming_activities': {
        const offset = Number(args.offset ?? 0) || 0;
        const { activities } = await getActivitiesContent();
        const open = activities
          .filter((a) => a.archived !== true && a.isFull !== true)
          .map(activityView);
        return paginated(open, offset);
      }
      case 'search_activities': {
        const query = String(args.query ?? '').trim();
        if (!query) return { error: 'query wajib diisi' };
        const offset = Number(args.offset ?? 0) || 0;
        return searchActivities(query, offset);
      }
      case 'search_activities_by_category': {
        const category = String(args.category ?? '').trim();
        if (!category) return { error: 'category wajib diisi' };
        const offset = Number(args.offset ?? 0) || 0;
        return searchActivitiesByCategory(category, offset);
      }
      case 'get_my_skills': {
        const skills = await getSkillPointsForUser(user.email);
        return skills
          ? {
              skills: SKILL_KEYS.map((k) => ({
                skill: SKILL_LABELS[k],
                value: skills.values[k],
                subStats: skills.subStats[k],
              })),
              activitiesAssessed: skills.activityCount,
            }
          : { skills: [], note: 'Member belum pernah dinilai.' };
      }
      case 'get_my_performance': {
        const activityId = String(args.activityId ?? '').trim();
        if (activityId) {
          const all = await listAllUserPerformance();
          return {
            activityId,
            rows: all
              .filter(
                (r) =>
                  r.userEmail === user.email.trim().toLowerCase() &&
                  r.activityId === activityId,
              )
              .map((r) => ({ skill: r.skill, target: r.target, kesalahan: r.kesalahan })),
          };
        }
        const agg = await getPerformanceForUser(user.email);
        return agg
          ? { labels: agg.labels, target: agg.target, kesalahan: agg.kesalahan, activityCount: agg.activityCount }
          : { note: 'Belum ada data performance.' };
      }
      case 'get_my_achievements': {
        const badges = await listGrantedBadgesForUser(user.email);
        return {
          achievements: badges.map((b) => ({
            name: b.label,
            icon: b.icon,
            description: b.description,
            earnedAt: b.grantedAt,
          })),
        };
      }
      case 'get_my_matches':
        return myMatches(user);
      case 'recommend_activities':
        return recommendations(user);
      case 'get_my_signups':
        return mySignups(user);
      case 'book_activity': {
        const activityId = String(args.activityId ?? '').trim();
        if (!activityId) return { error: 'activityId wajib diisi' };
        const result = await registerUserForActivity(user, activityId, {
          message: 'Booking via WhatsApp',
        });
        if (!result.ok) return { error: result.error };
        return {
          ok: true,
          status: result.status,
          statusLabel: STATUS_LABELS[result.status] ?? result.status,
          created: result.created,
          note: result.created
            ? 'Pendaftaran baru — menunggu persetujuan admin.'
            : 'Member sudah terdaftar di activity ini.',
        };
      }
      case 'submit_payment_proof': {
        const signupId = String(args.signupId ?? '').trim();
        if (!signupId) return { error: 'signupId wajib diisi' };
        const proof = takePendingProof(chatId);
        if (!proof) {
          return {
            error:
              'Tidak ada bukti pembayaran yang terbaru di chat ini. Minta member mengirim ulang gambar/PDF bukti transfer, lalu panggil tool ini lagi.',
          };
        }
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return { error: 'Server belum terkonfigurasi' };
        const note = args.note
          ? String(args.note).trim().slice(0, 500) || undefined
          : undefined;
        const { signup, error } = await submitPaymentProof(
          spreadsheetId,
          signupId,
          user.email,
          proof.dataUrl,
          note,
        );
        if (!signup) return { error: error ?? 'Pendaftaran tidak ditemukan' };
        // Same admin notification as the website upload path.
        void notifyPaymentSubmitted(user.email, signup.activityId, proof.dataUrl, note, signup.id);
        return {
          ok: true,
          status: signup.status,
          statusLabel: STATUS_LABELS[signup.status] ?? signup.status,
          note: 'Bukti pembayaran terkirim, menunggu verifikasi admin.',
        };
      }
      case 'cancel_signup': {
        const signupId = String(args.signupId ?? '').trim();
        if (!signupId) return { error: 'signupId wajib diisi' };
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return { error: 'Server belum terkonfigurasi' };
        const reason = args.reason ? String(args.reason).slice(0, 500) : undefined;
        const { signup, error } = await cancelSignup(
          spreadsheetId,
          signupId,
          user.email,
          reason,
        );
        if (!signup) return { error: error ?? 'Pendaftaran tidak ditemukan' };
        return { ok: true, status: signup.status, cancelledAt: signup.decidedAt };
      }
      default:
        return { error: `Tool tidak dikenal: ${name}` };
    }
  } catch (error) {
    console.error(`runBotTool ${name} failed:`, error);
    return { error: 'Terjadi kesalahan server saat menjalankan aksi.' };
  }
}
