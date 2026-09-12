// ============================================
// SUPABASE DATA LAYER
// ============================================
// Drop-in replacement for the old Google Sheets layer. Same function
// signatures so the stores (lib/*-store.ts) and routes keep working.
// spreadsheetId args are ignored — kept only so call sites don't change.
//
// Tables are 1:1 with the old sheet names (see supabase/schema.sql).
// RLS is enabled with no policies (deny-all); the app connects with the
// service role key, which bypasses RLS.

import { createClient } from '@supabase/supabase-js';

export type PagedRows = {
  rows: Record<string, unknown>[];
  total: number;
  offset: number;
  limit: number;
};

export function isConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim() &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)?.trim(),
  );
}

// Legacy shim: stores/routes used to thread a Google-Spreadsheet id around as
// proof of config. The id args are ignored — this now just gates on Supabase env.
export function getSpreadsheetId(): string | null {
  return isConfigured() ? 'supabase' : null;
}

function getClient() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();
  if (!url || !key) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Reuse one client across hot reloads / serverless invocations.
const g = globalThis as unknown as { __dt_supabase__?: ReturnType<typeof getClient> };
function db() {
  if (!g.__dt_supabase__) g.__dt_supabase__ = getClient();
  return g.__dt_supabase__;
}

const TABLES = new Set([
  'users', 'invites',
  'hero_settings', 'hero_slides',
  'activities_settings', 'activities_items',
  'activity_signups', 'activity_matches',
  'coupons', 'coupon_claims',
  'badges', 'user_badges',
  'user_skill_points', 'user_performance_points',
  'gallery_settings', 'gallery_items',
  'faq_settings', 'faq_items',
  'calendar_settings', 'calendar_events',
  'testimonials_settings', 'testimonials_items',
  'statistics_items',
  'why_join_settings', 'why_join_benefits',
  'our_story_settings',
  'click_events',
] as const);

// Old sheet name aliases → table names (why_join_benefits sheet was created
// under a different title in a few stores).
const SHEET_ALIASES: Record<string, string> = {
  why_join_benefits: 'why_join_benefits',
};

function tableFor(sheetName: string): string {
  const t = SHEET_ALIASES[sheetName] ?? sheetName;
  if (!TABLES.has(t as never)) {
    throw new Error(`Unknown table: ${sheetName}`);
  }
  return t;
}

const SEQ_KEY = 'seq';

function dropInternalColumns(row: Record<string, unknown>) {
  const { [SEQ_KEY]: _seq, ...rest } = row;
  return rest;
}

// ============ READS ============

export async function listRowsBySheet(
  _spreadsheetId: string,
  sheetName: string,
  _ttlMs?: number,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await db()
    .from(tableFor(sheetName))
    .select('*')
    .order(SEQ_KEY, { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(dropInternalColumns);
}

export async function listRowsBySheetPaged(
  _spreadsheetId: string,
  sheetName: string,
  options: { offset?: number; limit: number },
): Promise<PagedRows> {
  const { offset = 0, limit } = options;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('listRowsBySheetPaged: limit must be a positive integer');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('listRowsBySheetPaged: offset must be a non-negative integer');
  }
  const client = db();
  const table = tableFor(sheetName);
  const [rowsRes, countRes] = await Promise.all([
    client.from(table).select('*').order(SEQ_KEY).range(offset, offset + limit - 1),
    client.from(table).select('id', { count: 'exact', head: true }),
  ]);
  if (rowsRes.error) throw new Error(rowsRes.error.message);
  if (countRes.error) throw new Error(countRes.error.message);
  return {
    rows: (rowsRes.data ?? []).map(dropInternalColumns),
    total: countRes.count ?? 0,
    offset,
    limit,
  };
}

export async function readRowById(
  _spreadsheetId: string,
  sheetName: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db()
    .from(tableFor(sheetName))
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? dropInternalColumns(data as Record<string, unknown>) : null;
}

// ============ FILTERED READS (admin views) ============
// The read-all + JS-sort pattern of the older stores doesn't scale to
// append-only event tables (click_events grows unbounded), so this one
// helper pushes filter/sort/range down to Postgres.

export type SheetFilterOp = 'gte' | 'lte' | 'ilike' | 'eq';
export type SheetFilter = { op: SheetFilterOp; column: string; value: string };

export type QueryRowsOptions = {
  /** ANDed column filters. `ilike` values must be pre-escaped by the caller. */
  filters?: SheetFilter[];
  /**
   * Raw supabase-js `.or()` query string for cross-column search, e.g.
   * "buttonText.ilike.%Daftar%,ip.ilike.%1.2%". Caller builds it; the shim
   * only forwards it.
   */
  orQuery?: string;
  orderBy?: string;
  ascending?: boolean;
  offset?: number;
  limit?: number;
  /** Also return an exact total count (one extra head request). */
  exactCount?: boolean;
};

export async function queryRowsBySheet(
  _spreadsheetId: string,
  sheetName: string,
  options: QueryRowsOptions,
): Promise<{ rows: Record<string, unknown>[]; total?: number }> {
  const table = tableFor(sheetName);
  const build = () => {
    let q = db().from(table).select('*');
    for (const f of options.filters ?? []) {
      // Index-style call: TS can't unify the overloaded per-op filter builders
      // when the op is a union, and referencing the builder's own type here
      // recurses infinitely. All four ops share a (column, value) shape.
      type Builder = Record<string, (column: string, value: string) => unknown>;
      q = (q as unknown as Builder)[f.op](f.column, f.value) as typeof q;
    }
    if (options.orQuery) q = q.or(options.orQuery);
    if (options.orderBy) q = q.order(options.orderBy, { ascending: options.ascending ?? false });
    if (options.limit != null || options.offset != null) {
      const offset = options.offset ?? 0;
      q = q.range(offset, offset + (options.limit ?? 50) - 1);
    }
    return q;
  };

  const [rowsRes, countRes] = await Promise.all([
    build(),
    options.exactCount
      ? db().from(table).select('id', { count: 'exact', head: true })
      : Promise.resolve(null),
  ]);
  if (rowsRes.error) throw new Error(rowsRes.error.message);
  const countData = await countRes;
  if (countData?.error) throw new Error(countData.error.message);
  return {
    rows: (rowsRes.data ?? []).map(dropInternalColumns),
    total: countData ? (countData.count ?? 0) : undefined,
  };
}

// ============ WRITES ============

export async function createRowWithId(
  _spreadsheetId: string,
  sheetName: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; row?: Record<string, unknown> }> {
  const table = tableFor(sheetName);
  const { data: inserted, error } = await db()
    .from(table)
    .insert(data)
    .select()
    .single();
  if (error) {
    // Duplicate PK → mirror the old sheets race: return failure, not crash.
    if (error.code === '23505') {
      return { success: false };
    }
    throw new Error(error.message);
  }
  return { success: true, row: dropInternalColumns(inserted) };
}

export async function updateRowById(
  _spreadsheetId: string,
  sheetName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean }> {
  const { error } = await db()
    .from(tableFor(sheetName))
    .update(data)
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteRowById(
  _spreadsheetId: string,
  sheetName: string,
  id: string,
): Promise<{ success: boolean }> {
  const { error } = await db()
    .from(tableFor(sheetName))
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Batch insert (click tracking). No RETURNING — callers don't need rows back. */
export async function insertRowsBatch(
  _spreadsheetId: string,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<{ success: boolean; count: number }> {
  if (rows.length === 0) return { success: true, count: 0 };
  const { error } = await db().from(tableFor(sheetName)).insert(rows);
  if (error) throw new Error(error.message);
  return { success: true, count: rows.length };
}

// ============ COMPAT NO-OPS ============
// The old layer managed per-sheet caches and auto-created sheets with
// headers. Postgres needs neither: no client cache (queries are cheap) and
// tables are created once via supabase/schema.sql.

export async function ensureSheetWithHeaders(
  _spreadsheetId: string,
  _sheetName: string,
  _headers: string[],
): Promise<void> {}

export function invalidateRowsCache(
  _spreadsheetId?: string,
  _sheetName?: string,
): void {}
