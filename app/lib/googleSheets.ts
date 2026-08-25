import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import crypto from 'crypto';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
export const SHEET_ROWS_SLOW_TTL_MS = 15 * 60 * 1000; // 15 minutes for stable sheets

type CacheEntry<T> = { expiresAt: number; value: T };

function getCacheStore() {
  const g = globalThis as unknown as {
    __remember_google_sheets_cache__?: Map<string, CacheEntry<unknown>>;
  };
  if (!g.__remember_google_sheets_cache__) {
    g.__remember_google_sheets_cache__ = new Map<string, CacheEntry<unknown>>();
  }
  return g.__remember_google_sheets_cache__;
}

function cacheGet<T>(key: string): T | null {
  const store = getCacheStore();
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs = CACHE_TTL_MS) {
  const store = getCacheStore();
  store.set(key, { expiresAt: Date.now() + ttlMs, value } as CacheEntry<unknown>);
}

function cacheDeleteByPrefix(prefix: string) {
  const store = getCacheStore();
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

function cacheDeleteMatching(predicate: (key: string) => boolean) {
  const store = getCacheStore();
  for (const k of store.keys()) {
    if (predicate(k)) store.delete(k);
  }
}

export function clearAllGoogleSheetsCache() {
  const store = getCacheStore();
  const size = store.size;
  store.clear();
  return { cleared: size };
}

// Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];
const jwt = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

export async function getGoogleSheet(spreadsheetId: string) {
  const key = `doc:${spreadsheetId}`;
  const cached = cacheGet<GoogleSpreadsheet>(key);
  if (cached) return cached;

  // Cache the in-flight load to avoid thundering-herd.
  const inflightKey = `doc_promise:${spreadsheetId}`;
  const inflight = cacheGet<Promise<GoogleSpreadsheet>>(inflightKey);
  if (inflight) return inflight;

  const p = (async () => {
    const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
    await doc.loadInfo();
    cacheSet(key, doc);
    return doc;
  })();
  cacheSet(inflightKey, p, 30_000);
  try {
    return await p;
  } finally {
    const store = getCacheStore();
    store.delete(inflightKey);
  }
}

export async function readSheetData(spreadsheetId: string, sheetName?: string) {
  try {
    const cacheKey = `read:${spreadsheetId}:${sheetName || '__index0__'}`;
    const cached = cacheGet<Record<string, unknown>[]>(cacheKey);
    if (cached) return cached;

    const inflightKey = `${cacheKey}:promise`;
    const inflight = cacheGet<Promise<Record<string, unknown>[]>>(inflightKey);
    if (inflight) return inflight;

    const p = (async () => {
      const doc = await getGoogleSheet(spreadsheetId);
      let sheet = sheetName ? doc.sheetsByTitle[sheetName] : doc.sheetsByIndex[0];

      if (!sheet) {
        sheet = await doc.addSheet({ title: sheetName });
      }
      const rows = await sheet.getRows();
      const out = rows.map(row => row.toObject());
      cacheSet(cacheKey, out);
      return out;
    })();
    cacheSet(inflightKey, p, 30_000);
    try {
      return await p;
    } finally {
      const store = getCacheStore();
      store.delete(inflightKey);
    }

  } catch (error) {
    console.error('Error reading from Google Sheet:', error);
    throw error;
  }
}

export async function clearSheetData(spreadsheetId: string, sheetName?: string) {
  try {
    const cacheKey = `read:${spreadsheetId}:${sheetName || '__index0__'}`;
    cacheDeleteByPrefix(cacheKey);
    const inflightKey = `${cacheKey}:promise`;
    const inflight = cacheGet<Promise<Record<string, unknown>[]>>(inflightKey);
    if (inflight) return inflight;

    const p = (async () => {
      const doc = await getGoogleSheet(spreadsheetId);
      let sheet = sheetName ? doc.sheetsByTitle[sheetName] : doc.sheetsByIndex[0];

      if (!sheet) {
        sheet = await doc.addSheet({ title: sheetName });
      }
      const rows = await sheet.getRows();
      for (const row of rows) {
        await row.delete();
      }
      return { success: true };
    })();
    return await p;
  } catch (error) {
    console.error('Error reading from Google Sheet:', error);
    throw error;
  }
}

export async function appendSheetData(
  spreadsheetId: string,
  data: Record<string, unknown>[],
  sheetNameOrIndex?: string | number
) {
  try {
    const doc = await getGoogleSheet(spreadsheetId);
    let sheet;
    if (typeof sheetNameOrIndex === 'string') {
      sheet = doc.sheetsByTitle[sheetNameOrIndex];
      if (!sheet && data.length > 0) {
        const headers = Object.keys(data[0]);
        sheet = await doc.addSheet({ title: sheetNameOrIndex, headerValues: headers });
      }
    } else {
      sheet = doc.sheetsByIndex[sheetNameOrIndex ?? 0];
    }
    if (!sheet) throw new Error('Sheet not found');
    await sheet.addRows(data as unknown as Parameters<typeof sheet.addRows>[0]);
    // Invalidate cached reads for this spreadsheet.
    cacheDeleteByPrefix(`read:${spreadsheetId}:`);
    cacheDeleteByPrefix(`rows:${spreadsheetId}:`);
    cacheDeleteMatching((k) => k.startsWith(`read:${spreadsheetId}:`) && k.endsWith(":promise"));
    cacheDeleteMatching((k) => k.startsWith(`rows:${spreadsheetId}:`) && k.endsWith(":promise"));
    return { success: true, message: 'Data added successfully' };
  } catch (error) {
    console.error('Error writing to Google Sheet:', error);
    throw error;
  }
}

export async function updateSheetData(
  spreadsheetId: string,
  rowIndex: number,
  data: Record<string, unknown>,
  sheetIndex = 0
) {
  try {
    const doc = await getGoogleSheet(spreadsheetId);
    const sheet = doc.sheetsByIndex[sheetIndex];
    const rows = await sheet.getRows();

    if (rowIndex >= rows.length) {
      throw new Error('Row index out of bounds');
    }

    const row = rows[rowIndex];
    Object.entries(data).forEach(([key, value]) => {
      (row as unknown as Record<string, unknown>)[key] = value;
    });
    await row.save();
    cacheDeleteByPrefix(`read:${spreadsheetId}:`);
    cacheDeleteByPrefix(`rows:${spreadsheetId}:`);
    cacheDeleteMatching((k) => k.startsWith(`read:${spreadsheetId}:`) && k.endsWith(":promise"));
    cacheDeleteMatching((k) => k.startsWith(`rows:${spreadsheetId}:`) && k.endsWith(":promise"));

    return { success: true, message: 'Row updated successfully' };
  } catch (error) {
    console.error('Error updating Google Sheet:', error);
    throw error;
  }
}

// New helpers for id-based CRUD on a named sheet
type InflightRowsRequest = {
  gen: number;
  promise: Promise<Record<string, unknown>[]>;
};

const sheetGenerations = new Map<string, number>();

function sheetGenKey(spreadsheetId: string, sheetName: string) {
  return `${spreadsheetId}:${sheetName}`;
}

function getSheetGeneration(spreadsheetId: string, sheetName: string) {
  return sheetGenerations.get(sheetGenKey(spreadsheetId, sheetName)) ?? 0;
}

function bumpSheetGeneration(spreadsheetId: string, sheetName: string) {
  const key = sheetGenKey(spreadsheetId, sheetName);
  sheetGenerations.set(key, (sheetGenerations.get(key) ?? 0) + 1);
}

function invalidateRowsCache(spreadsheetId: string, sheetName: string) {
  bumpSheetGeneration(spreadsheetId, sheetName);
  cacheDeleteByPrefix(`read:${spreadsheetId}:`);
  cacheDeleteByPrefix(`rows:${spreadsheetId}:${sheetName}`);
  cacheDeleteMatching((k) => k.startsWith(`read:${spreadsheetId}:`) && k.endsWith(':promise'));
  cacheDeleteMatching(
    (k) => k.startsWith(`rows:${spreadsheetId}:${sheetName}`) && k.endsWith(':promise')
  );
}

export async function ensureSheetWithHeaders(
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
) {
  const verifyKey = `verified:${spreadsheetId}:${sheetName}:${headers.join(',')}`;
  const doc = await getGoogleSheet(spreadsheetId);
  let sheet = doc.sheetsByTitle[sheetName];

  if (cacheGet<boolean>(verifyKey) && sheet) {
    return sheet;
  }

  if (!sheet) {
    sheet = await doc.addSheet({ title: sheetName, headerValues: headers });
    invalidateRowsCache(spreadsheetId, sheetName);
    cacheSet(verifyKey, true, 60 * 60 * 1000);
    return sheet;
  }

  await sheet.loadHeaderRow();
  const existing = Array.isArray(sheet.headerValues) ? sheet.headerValues : [];
  const missing = headers.filter((h) => !existing.includes(h));
  if (missing.length > 0) {
    await sheet.setHeaderRow([...existing, ...missing]);
    await sheet.loadHeaderRow();
    invalidateRowsCache(spreadsheetId, sheetName);
  }

  cacheSet(verifyKey, true, 60 * 60 * 1000);
  return sheet;
}

export async function listRowsBySheet(
  spreadsheetId: string,
  sheetName: string,
  ttlMs = CACHE_TTL_MS
) {
  const cacheKey = `rows:${spreadsheetId}:${sheetName}`;
  const genAtStart = getSheetGeneration(spreadsheetId, sheetName);
  const cached = cacheGet<Record<string, unknown>[]>(cacheKey);
  if (cached) return cached;

  const inflightKey = `${cacheKey}:promise`;
  const inflight = cacheGet<InflightRowsRequest>(inflightKey);
  if (inflight && inflight.gen === genAtStart) return inflight.promise;

  const p = (async () => {
    const doc = await getGoogleSheet(spreadsheetId);
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) return [];
    const rows = await sheet.getRows();
    const out = rows.map((r) => r.toObject());
    if (getSheetGeneration(spreadsheetId, sheetName) === genAtStart) {
      cacheSet(cacheKey, out, ttlMs);
    }
    return out;
  })();
  cacheSet(inflightKey, { gen: genAtStart, promise: p }, 30_000);
  try {
    return await p;
  } finally {
    const store = getCacheStore();
    store.delete(inflightKey);
  }
}

export async function createRowWithId(
  spreadsheetId: string,
  sheetName: string,
  data: Record<string, unknown>
) {
  const id = crypto.randomUUID();
  const sheet = await ensureSheetWithHeaders(spreadsheetId, sheetName, ['id']);
  await sheet.addRow({ id, ...data });
  cacheDeleteByPrefix(`read:${spreadsheetId}:`);
  cacheDeleteByPrefix(`rows:${spreadsheetId}:${sheetName}`);
  cacheDeleteMatching((k) => k.startsWith(`read:${spreadsheetId}:`) && k.endsWith(":promise"));
  cacheDeleteMatching(
    (k) => k.startsWith(`rows:${spreadsheetId}:${sheetName}`) && k.endsWith(":promise")
  );
  return { id };
}

type SheetRow = { toObject(): Record<string, unknown> };

function rowMatchesId(row: SheetRow, id: string): boolean {
  const obj = row.toObject();
  return String(obj.id ?? '').trim() === String(id).trim();
}

export async function findRowIndexById(
  spreadsheetId: string,
  sheetName: string,
  id: string
) {
  const doc = await getGoogleSheet(spreadsheetId);
  const sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) return -1;
  const rows = await sheet.getRows();
  return rows.findIndex((r) => rowMatchesId(r, id));
}

export async function readRowById(
  spreadsheetId: string,
  sheetName: string,
  id: string
) {
  const doc = await getGoogleSheet(spreadsheetId);
  const sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) return null;
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  const row = rows.find((r) => rowMatchesId(r, id));
  if (!row) return null;
  return row.toObject();
}

type SheetRowWritable = {
  toObject(): Record<string, unknown>;
  assign(obj: Record<string, unknown>): void;
  save(options?: { raw?: boolean }): Promise<void>;
  delete(): Promise<void>;
};

function sheetValueToCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function assignRowData(
  row: SheetRowWritable,
  headerValues: string[],
  data: Record<string, unknown>
): void {
  const headers = new Set(headerValues.filter(Boolean));
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    if (!headers.has(key)) continue;
    patch[key] = sheetValueToCell(value);
  }

  if (Object.keys(patch).length === 0) return;
  row.assign(patch);
}

export async function updateRowById(
  spreadsheetId: string,
  sheetName: string,
  id: string,
  data: Record<string, unknown>
) {
  const doc = await getGoogleSheet(spreadsheetId);
  const sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) throw new Error('Sheet not found');
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  const row = rows.find((r) => rowMatchesId(r, id)) as SheetRowWritable | undefined;
  if (!row) throw new Error(`Row not found: ${id}`);

  assignRowData(row, sheet.headerValues, data);
  await row.save();

  cacheDeleteByPrefix(`read:${spreadsheetId}:`);
  cacheDeleteByPrefix(`rows:${spreadsheetId}:${sheetName}`);
  cacheDeleteMatching((k) => k.startsWith(`read:${spreadsheetId}:`) && k.endsWith(":promise"));
  cacheDeleteMatching(
    (k) => k.startsWith(`rows:${spreadsheetId}:${sheetName}`) && k.endsWith(":promise")
  );
  return { success: true };
}

export async function deleteRowById(
  spreadsheetId: string,
  sheetName: string,
  id: string
) {
  const doc = await getGoogleSheet(spreadsheetId);
  const sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) throw new Error('Sheet not found');
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  const row = rows.find((r) => rowMatchesId(r, id)) as SheetRowWritable | undefined;
  if (!row) throw new Error(`Row not found: ${id}`);
  await row.delete();
  cacheDeleteByPrefix(`read:${spreadsheetId}:`);
  cacheDeleteByPrefix(`rows:${spreadsheetId}:${sheetName}`);
  cacheDeleteMatching((k) => k.startsWith(`read:${spreadsheetId}:`) && k.endsWith(":promise"));
  cacheDeleteMatching(
    (k) => k.startsWith(`rows:${spreadsheetId}:${sheetName}`) && k.endsWith(":promise")
  );
  return { success: true };
}