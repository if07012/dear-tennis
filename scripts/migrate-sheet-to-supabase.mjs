// One-time migration: Google Sheets → Supabase.
// Run: node --env-file=.env scripts/migrate-sheet-to-supabase.mjs
// Reads every tab (by table name) from the old spreadsheet and upserts rows
// into the matching Supabase table. Idempotent — rerun skips/overwrites by id.

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const spreadsheetId =
  process.env.USERS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
if (!spreadsheetId) throw new Error('USERS_SPREADSHEET_ID not set');

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');

// Column → type coercion for typed columns; everything else is text.
const BOOL = new Set(['isFull', 'archived', 'isDoubles']);
const INT = new Set([
  'order', 'matchIndex', 'set1A', 'set1B', 'set2A', 'set2B', 'set3A', 'set3B',
  'forehand', 'backhand', 'serve', 'volley', 'footwork', 'strategy',
  'accuracy', 'power', 'consistency', 'speed', 'agility', 'balance',
  'forehandTarget', 'backhandTarget', 'serveTarget', 'volleyTarget',
  'footworkTarget', 'forehandKesalahan', 'backhandKesalahan',
  'serveKesalahan', 'volleyKesalahan', 'footworkKesalahan',
]);

const TABLES = [
  'users', 'invites',
  'hero_settings', 'hero_slides',
  'activities_settings', 'activities_items',
  'activity_signups', 'activity_matches',
  'badges', 'user_badges',
  'user_skill_points', 'user_performance_points',
  'gallery_settings', 'gallery_items',
  'faq_settings', 'faq_items',
  'calendar_settings', 'calendar_events',
  'testimonials_settings', 'testimonials_items',
  'statistics_items',
  'why_join_settings', 'why_join_benefits',
  'our_story_settings',
];

function coerce(key, raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (BOOL.has(key)) {
    return raw === true || raw === 1 || String(raw).toLowerCase() === 'true' || String(raw) === '1';
  }
  if (INT.has(key)) {
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return String(raw);
}

const jwt = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const supabase = createClient(url, key);

console.log('Loading spreadsheet', spreadsheetId);
const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
await doc.loadInfo();
console.log('Loaded:', doc.title, '— tabs:', doc.sheetsByIndex.map((s) => s.title).join(', '));

for (const table of TABLES) {
  const sheet = doc.sheetsByTitle[table];
  if (!sheet) {
    console.log(`SKIP ${table} — no tab with this name`);
    continue;
  }
  const rows = await sheet.getRows();
  const records = [];
  for (const r of rows) {
    const obj = r.toObject();
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const val = coerce(k, v);
      if (val !== undefined) out[k] = val;
    }
    if (!out.id) {
      if (records.length === 0 && rows.length === 1) {
        // single-row settings tab without an id → 'current'
        out.id = 'current';
      } else {
        out.id = crypto.randomUUID();
      }
    }
    records.push(out);
  }
  if (records.length === 0) {
    console.log(`EMPTY ${table} — nothing to insert`);
    continue;
  }
  const { error } = await supabase.from(table).upsert(records, { onConflict: 'id' });
  if (error) {
    console.error(`FAIL  ${table}: ${error.message}`);
  } else {
    console.log(`OK    ${table}: ${records.length} rows upserted`);
  }
}
console.log('Done.');
