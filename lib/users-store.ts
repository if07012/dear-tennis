// ============================================
// USERS DATA STORE (admin)
// ============================================
// Reads the `users` sheet so admins can list, paginate, and manage members
// from /admin/users. Mirrors the existing editor pattern (gallery, our-story).
//
// Sheet schema (created on first read):
//   id, email, name, passwordHash, salt, createdAt, role
//
// `role` is optional for backward compatibility with rows seeded by older
// code paths (e.g. lib/seedAdmin.ts). Missing/blank role defaults to
// `member`. The configured ADMIN_EMAIL is always normalised to `admin` on
// read so the UI reflects actual permissions even if the sheet row drifts.

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
  readRowById,
  updateRowById,
  deleteRowById,
} from '@/app/lib/supabase';

const USERS_SHEET = 'users';

// Header order matters: `id` first so the helpers in app/lib/googleSheets
// can keep using column-A scans. Optional columns (`role`, `photo`) are
// appended so older sheets that pre-date them don't need a destructive
// migration — `ensureSheetWithHeaders` will append them the first time
// it runs.
const USERS_HEADERS = [
  'id',
  'email',
  'name',
  'passwordHash',
  'salt',
  'createdAt',
  'role',
  'photo',
  'rank',
  'phone',
];

export type UserRole = 'admin' | 'member';

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  /**
   * Optional URL to the member's profile photo. Used by the home-page
   * activity card popup. Older rows (pre-photo column) read as undefined.
   */
  photo?: string;
  /**
   * Free-form rank label (e.g. "3.5 NTRP", "Beginner", "Captain"). Edited
   * from the profile page. Optional so older rows read as undefined.
   */
  rank?: string;
  /**
   * Optional phone number. Collected at registration and editable from the
   * profile page. Optional so older rows read as undefined.
   */
  phone?: string;
};

export type PagedUsers = {
  users: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function configuredAdminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
}

function coerceRole(value: unknown, email: string): UserRole {
  const normalised = String(value ?? '').trim().toLowerCase();
  if (normalised === 'admin' || normalised === 'member') return normalised;
  // No role on the row — fall back to ADMIN_EMAIL so the UI never lies
  // about who can actually open /admin/*.
  const adminEmail = configuredAdminEmail();
  if (adminEmail && email.toLowerCase() === adminEmail) return 'admin';
  return 'member';
}

function coerceUser(r: Record<string, unknown>): UserRecord {
  const email = String(r.email ?? '').trim();
  return {
    id: String(r.id ?? '').trim(),
    email,
    name: String(r.name ?? '').trim() || email,
    role: coerceRole(r.role, email),
    createdAt: String(r.createdAt ?? '').trim(),
    photo: r.photo ? String(r.photo).trim() || undefined : undefined,
    rank: r.rank ? String(r.rank).trim() || undefined : undefined,
    phone: r.phone ? String(r.phone).trim() || undefined : undefined,
  };
}

function normalisePageArgs(args?: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const pageSize = Math.max(
    1,
    Math.min(100, Math.floor(args?.pageSize ?? 10) || 10),
  );
  const page = Math.max(1, Math.floor(args?.page ?? 1) || 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function sortUsers(users: UserRecord[]): UserRecord[] {
  // Newest first by createdAt; fall back to email so the order is stable
  // when createdAt is missing on legacy rows.
  return users.slice().sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.email.localeCompare(b.email);
  });
}

async function ensureUsersSheet(spreadsheetId: string) {
  return ensureSheetWithHeaders(spreadsheetId, USERS_SHEET, [...USERS_HEADERS]);
}

export async function getUsersContentForAdmin(args?: {
  page?: number;
  pageSize?: number;
}): Promise<PagedUsers> {
  const { page, pageSize, offset } = normalisePageArgs(args);
  const spreadsheetId = getSpreadsheetId();

  if (!spreadsheetId) {
    return {
      users: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  try {
    await ensureUsersSheet(spreadsheetId);
    // listRowsBySheet (not listRowsBySheetPaged): the paged cache is keyed
    // on (offset, limit) and is NOT invalidated by callers that go through
    // sheet.addRow() directly (e.g. the invite accept endpoint). Reading the
    // full sheet and slicing here matches the gallery editor pattern and
    // makes newly-accepted users appear on the very next page load.
    const rows = await listRowsBySheet(spreadsheetId, USERS_SHEET);
    const all = sortUsers(rows.map(coerceUser));
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      users: all.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Failed to read users sheet for admin:', error);
    return { users: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

export async function getUserById(
  spreadsheetId: string,
  id: string,
): Promise<UserRecord | null> {
  const row = await readRowById(spreadsheetId, USERS_SHEET, id);
  if (!row) return null;
  return coerceUser(row);
}

/**
 * Returns the full sorted user list. Reserved for admin actions that need
 * to search across all rows (e.g. role lookups). Falls back to [] when the
 * sheet isn't configured.
 */
export async function listAllUsersForAdmin(): Promise<UserRecord[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureUsersSheet(spreadsheetId);
    const rows = await listRowsBySheet(spreadsheetId, USERS_SHEET);
    return sortUsers(rows.map(coerceUser));
  } catch (error) {
    console.error('Failed to list users for admin:', error);
    return [];
  }
}

export async function updateUserRole(
  spreadsheetId: string,
  id: string,
  role: UserRole,
): Promise<UserRecord> {
  await updateRowById(spreadsheetId, USERS_SHEET, id, { role });
  const updated = await getUserById(spreadsheetId, id);
  if (!updated) throw new Error(`User ${id} disappeared after update`);
  return updated;
}

export async function deleteUserForAdmin(
  spreadsheetId: string,
  id: string,
): Promise<{ deletedEmail: string }> {
  const existing = await getUserById(spreadsheetId, id);
  if (!existing) {
    return { deletedEmail: '' };
  }
  await deleteRowById(spreadsheetId, USERS_SHEET, id);
  return { deletedEmail: existing.email };
}

export { USERS_SHEET, USERS_HEADERS };
