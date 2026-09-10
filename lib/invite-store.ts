// ============================================
// INVITE DATA STORE
// ============================================
// Reads/writes pending member invitations for the admin "Invite Members"
// page from a Google Sheet. Reuses the existing helpers in
// app/lib/supabase.ts.
//
// All access goes through admin-only API routes — there's no public read
// for this store, so we don't expose a public cache.
//
// Sheet schema (created on first save):
//   invites: id,email,name,message,status,invitedAt,createdBy

import {
  ensureSheetWithHeaders,
  listRowsBySheet,
  getSpreadsheetId,
  readRowById,
  updateRowById,
} from '@/app/lib/supabase';
import {
  INVITE_ITEM_HEADERS,
  INVITE_STATUSES,
  type Invite,
  type InviteStatus,
} from '@/data/invite-types';

const ITEMS_SHEET = 'invites';

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

function coerceStatus(raw: unknown): InviteStatus {
  const value = String(raw ?? '').trim();
  return (INVITE_STATUSES as readonly string[]).includes(value)
    ? (value as InviteStatus)
    : 'pending';
}

function coerceItem(r: Record<string, unknown>, idx: number): Invite {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    email: String(r.email ?? '').trim(),
    name: r.name ? String(r.name) : undefined,
    message: r.message ? String(r.message) : undefined,
    status: coerceStatus(r.status),
    invitedAt: String(r.invitedAt ?? ''),
    createdBy: String(r.createdBy ?? ''),
    token: r.token ? String(r.token).trim() || undefined : undefined,
  };
}

function coerceItems(rows: Record<string, unknown>[]): Invite[] {
  // A row is valid as long as it has a non-empty email — name/message can be
  // added later. Truly blank rows are dropped.
  const out = rows
    .filter((r) => String(r.email ?? '').trim().length > 0)
    .map((r, idx) => coerceItem(r, idx));
  // Newest first so the admin sees recent activity at the top.
  return out.sort(
    (a, b) =>
      new Date(b.invitedAt || 0).getTime() -
      new Date(a.invitedAt || 0).getTime(),
  );
}

/** Paginated envelope returned by admin reads. */
export type PagedInviteContent = {
  items: Invite[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function normalizePageArgs(
  args: { page?: number; pageSize?: number } | undefined,
  fallbackPageSize: number,
): { page: number; pageSize: number; offset: number } {
  const pageSize = Math.max(
    1,
    Math.min(200, Math.floor(args?.pageSize ?? fallbackPageSize) || fallbackPageSize),
  );
  const page = Math.max(1, Math.floor(args?.page ?? 1) || 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function getInviteCount(spreadsheetId: string): Promise<number> {
  const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  return coerceItems(itemRows).length;
}

export async function getInviteContentForAdmin(
  args?: { page?: number; pageSize?: number },
): Promise<PagedInviteContent> {
  const spreadsheetId = getSpreadsheetId();
  const FALLBACK_PAGE_SIZE = 10;
  const { page, pageSize, offset } = normalizePageArgs(args, FALLBACK_PAGE_SIZE);

  if (!spreadsheetId) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  try {
    const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
    const allItems = coerceItems(itemRows);
    const total = allItems.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: allItems.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Failed to read invite content for admin:', error);
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }
}

export async function ensureInviteSheets(spreadsheetId: string) {
  await ensureSheetWithHeaders(spreadsheetId, ITEMS_SHEET, [
    ...INVITE_ITEM_HEADERS,
  ]);
}

export { ITEMS_SHEET };
export type { Invite };
export { INVITE_ITEM_HEADERS };

/**
 * Find an invite by its public token. Returns null when the token doesn't
 * match any row. Email and message are scrubbed from the public result so
 * a leaked URL doesn't expose the admin's note.
 */
export type PublicInvite = {
  email: string;
  name?: string;
  status: Invite['status'];
};

export async function getInviteByTokenForPublic(
  spreadsheetId: string,
  token: string,
): Promise<PublicInvite | null> {
  const rows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  const target = token.trim().toLowerCase();
  const found = rows.find((r) => {
    const raw = r.token;
    return typeof raw === 'string' && raw.trim().toLowerCase() === target;
  });
  if (!found) return null;
  return coercePublic(found);
}

/**
 * Internal variant: returns the full invite (including the row id needed for
 * updates) without exposing it off the server. Used by the accept endpoint.
 */
export async function getInviteByToken(
  spreadsheetId: string,
  token: string,
): Promise<Invite | null> {
  const rows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  const target = token.trim().toLowerCase();
  const found = rows.find((r) => {
    const raw = r.token;
    return typeof raw === 'string' && raw.trim().toLowerCase() === target;
  });
  if (!found) return null;
  return coerceItem(found, 0);
}

function coercePublic(r: Record<string, unknown>): PublicInvite {
  const status = coerceStatus(r.status);
  return {
    email: String(r.email ?? '').trim(),
    name: r.name ? String(r.name) : undefined,
    status,
  };
}

export async function markInviteAccepted(
  spreadsheetId: string,
  id: string,
): Promise<void> {
  await updateRowById(spreadsheetId, ITEMS_SHEET, id, { status: 'accepted' });
}

/**
 * Reads the user-facing view of an invite by its row id. Used by admin
 * pages that need to surface token / status without exposing it elsewhere.
 */
export async function getInviteById(
  spreadsheetId: string,
  id: string,
): Promise<Invite | null> {
  const row = await readRowById(spreadsheetId, ITEMS_SHEET, id);
  if (!row) return null;
  return coerceItem(row, 0);
}