// ============================================
// INVITE DATA STORE
// ============================================
// Reads/writes pending member invitations for the admin "Invite Members"
// page from a Google Sheet. Reuses the existing helpers in
// app/lib/googleSheets.ts.
//
// All access goes through admin-only API routes — there's no public read
// for this store, so we don't expose a public cache.
//
// Sheet schema (created on first save):
//   invites: id,email,name,message,status,invitedAt,createdBy

import {
  ensureSheetWithHeaders,
  listRowsBySheet,
} from '@/app/lib/googleSheets';
import {
  INVITE_ITEM_HEADERS,
  INVITE_STATUSES,
  type Invite,
  type InviteStatus,
} from '@/data/invite-types';

const ITEMS_SHEET = 'invites';

function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID;
  return id && id.trim().length > 0 ? id : null;
}

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