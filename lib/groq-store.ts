// ============================================
// GROQ KEYS + LOGS + WA MESSAGES STORE
// ============================================
// Backing tables for the WhatsApp chatbot (PRD:
// chat-bot-mengguanakan-waha-pada-existing-tennis-community-export.md).
//   groq_keys  — admin-managed rotation pool, ordered by sortOrder
//   groq_logs  — every Groq attempt (key, status, durationMs)
//   wa_messages— both sides of every WhatsApp chat
// Mirrors the lib/users-store.ts pattern over the supabase shim.

import {
  getSpreadsheetId,
  listRowsBySheet,
  createRowWithId,
  updateRowById,
  deleteRowById,
  queryRowsBySheet,
  insertRowsBatch,
} from '@/app/lib/supabase';

const KEYS_SHEET = 'groq_keys';
const LOGS_SHEET = 'groq_logs';
const MESSAGES_SHEET = 'wa_messages';

export type GroqKeyRecord = {
  id: string;
  maskedKey: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
};

export type GroqLogRecord = {
  id: string;
  keyId: string;
  maskedKey: string;
  requestId: string;
  chatId: string;
  status: 'success' | '429' | 'error';
  durationMs: number;
  errorMessage?: string;
  createdAt: string;
};

export type WaMessageRecord = {
  id: string;
  chatId: string;
  userEmail: string;
  direction: 'in' | 'out';
  body: string;
  createdAt: string;
};

/** Internal shape: the full key never leaves this module's callers unmasked. */
type GroqKeyRow = GroqKeyRecord & { fullKey: string };

function coerceKeyRow(r: Record<string, unknown>): GroqKeyRow | null {
  const id = String(r.id ?? '').trim();
  const fullKey = String(r.fullKey ?? '').trim();
  if (!id || !fullKey) return null;
  return {
    id,
    fullKey,
    maskedKey: String(r.maskedKey ?? '').trim() || fullKey,
    sortOrder: Number.parseInt(String(r.sortOrder ?? '0'), 10) || 0,
    active: r.active !== false,
    createdAt: String(r.createdAt ?? ''),
  };
}

export async function listGroqKeyRows(): Promise<GroqKeyRow[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    const rows = await listRowsBySheet(spreadsheetId, KEYS_SHEET);
    return rows
      .map(coerceKeyRow)
      .filter((r): r is GroqKeyRow => r !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    console.error('Failed to list groq keys:', error);
    return [];
  }
}

/** Masked view for the admin UI — never includes the full key. */
export async function listGroqKeys(): Promise<GroqKeyRecord[]> {
  const rows = await listGroqKeyRows();
  return rows.map(({ fullKey: _fullKey, ...rest }) => rest);
}

export function maskGroqKey(fullKey: string): string {
  const key = fullKey.trim();
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function validateGroqKey(fullKey: string): string | null {
  const key = fullKey.trim();
  if (!key) return 'API key wajib diisi';
  if (key.length < 20) return 'API key tidak valid (terlalu pendek)';
  return null;
}

export async function addGroqKey(fullKey: string): Promise<GroqKeyRecord | null> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;
  const existing = await listGroqKeyRows();
  const row: GroqKeyRow = {
    id: crypto.randomUUID(),
    fullKey: fullKey.trim(),
    maskedKey: maskGroqKey(fullKey),
    sortOrder: existing.length,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await createRowWithId(spreadsheetId, KEYS_SHEET, { ...row });
  const { fullKey: _drop, ...masked } = row;
  return masked;
}

export async function deleteGroqKey(id: string): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return false;
  await deleteRowById(spreadsheetId, KEYS_SHEET, id);
  return true;
}

/** Reorder by explicit id list; ids not in the list keep their relative order at the end. */
export async function reorderGroqKeys(ids: string[]): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return false;
  const rows = await listGroqKeyRows();
  const order = new Map(ids.map((id, i) => [id, i]));
  await Promise.all(
    rows.map((r) => {
      const next = order.has(r.id) ? order.get(r.id)! : r.sortOrder + ids.length;
      return next === r.sortOrder
        ? Promise.resolve({ success: true })
        : updateRowById(spreadsheetId, KEYS_SHEET, r.id, { sortOrder: next });
    }),
  );
  return true;
}

// ============ GROQ LOGS ============

const LOG_STATUSES = ['success', '429', 'error'] as const;

export function isGroqLogStatus(v: string): v is GroqLogRecord['status'] {
  return (LOG_STATUSES as readonly string[]).includes(v);
}

export async function insertGroqLogs(
  entries: Array<Omit<GroqLogRecord, 'id' | 'createdAt'>>,
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId || entries.length === 0) return;
  const now = new Date().toISOString();
  await insertRowsBatch(
    spreadsheetId,
    LOGS_SHEET,
    entries.map((e) => ({ ...e, id: crypto.randomUUID(), createdAt: now })),
  );
}

export type PagedGroqLogs = {
  items: GroqLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listGroqLogs(args?: {
  page?: number;
  pageSize?: number;
  status?: GroqLogRecord['status'];
}): Promise<PagedGroqLogs> {
  const pageSize = Math.max(1, Math.min(100, Math.floor(args?.pageSize ?? 20) || 20));
  const page = Math.max(1, Math.floor(args?.page ?? 1) || 1);
  const spreadsheetId = getSpreadsheetId();
  const empty: PagedGroqLogs = { items: [], total: 0, page, pageSize, totalPages: 1 };
  if (!spreadsheetId) return empty;

  try {
    const { rows, total } = await queryRowsBySheet(spreadsheetId, LOGS_SHEET, {
      filters: args?.status ? [{ op: 'eq', column: 'status', value: args.status }] : undefined,
      orderBy: 'seq',
      ascending: false,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      exactCount: true,
    });
    const items = rows.map((r) => ({
      id: String(r.id ?? ''),
      keyId: String(r.keyId ?? ''),
      maskedKey: String(r.maskedKey ?? ''),
      requestId: String(r.requestId ?? ''),
      chatId: String(r.chatId ?? ''),
      status: (isGroqLogStatus(String(r.status ?? '')) ? String(r.status) : 'error') as GroqLogRecord['status'],
      durationMs: Number(r.durationMs) || 0,
      errorMessage: r.errorMessage ? String(r.errorMessage) : undefined,
      createdAt: String(r.createdAt ?? ''),
    }));
    return {
      items,
      total: total ?? items.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((total ?? items.length) / pageSize)),
    };
  } catch (error) {
    console.error('Failed to list groq logs:', error);
    return empty;
  }
}

// ============ WA MESSAGES ============

export async function insertWaMessage(
  entry: Omit<WaMessageRecord, 'id' | 'createdAt'>,
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return;
  await createRowWithId(spreadsheetId, MESSAGES_SHEET, {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

/** Newest-last (chronological) recent history for one chat. */
export async function listWaMessages(chatId: string, limit = 8): Promise<WaMessageRecord[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    const { rows } = await queryRowsBySheet(spreadsheetId, MESSAGES_SHEET, {
      filters: [{ op: 'eq', column: 'chatId', value: chatId }],
      orderBy: 'seq',
      ascending: false,
      limit,
    });
    return rows
      .map((r) => ({
        id: String(r.id ?? ''),
        chatId: String(r.chatId ?? ''),
        userEmail: String(r.userEmail ?? ''),
        direction: String(r.direction) === 'out' ? ('out' as const) : ('in' as const),
        body: String(r.body ?? ''),
        createdAt: String(r.createdAt ?? ''),
      }))
      .reverse();
  } catch (error) {
    console.error('Failed to list wa messages:', error);
    return [];
  }
}
