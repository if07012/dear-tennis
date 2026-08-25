// ===================================
// DEFAULT ADMIN SEEDER
// ===================================
// Idempotently ensures the admin user (configured via .env) exists in the
// `users` sheet. Safe to call on every login — does nothing if the row
// already exists.

import crypto from 'crypto';
import { ensureSheetWithHeaders } from '@/app/lib/googleSheets';
import { hashPassword } from '@/lib/auth';

const USERS_HEADERS = ['id', 'email', 'name', 'passwordHash', 'salt', 'createdAt'];

type SheetRow = { toObject(): Record<string, unknown> };

function isAdminConfigured(): { email: string; name: string; password: string } | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';
  if (!email || !password) return null;
  return { email, name, password };
}

export async function ensureAdminUser(spreadsheetId: string): Promise<{ seeded: boolean }> {
  const cfg = isAdminConfigured();
  if (!cfg) return { seeded: false };

  const sheet = await ensureSheetWithHeaders(spreadsheetId, 'users', USERS_HEADERS);
  const rows = (await sheet.getRows()) as unknown as SheetRow[];
  const existing = rows.find((r) => {
    const obj = r.toObject();
    return String(obj.email ?? '').trim().toLowerCase() === cfg.email;
  });
  if (existing) return { seeded: false };

  const { hash, salt } = await hashPassword(cfg.password);
  await sheet.addRow({
    id: crypto.randomUUID(),
    email: cfg.email,
    name: cfg.name,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  });
  return { seeded: true };
}
