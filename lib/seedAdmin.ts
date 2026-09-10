// ===================================
// DEFAULT ADMIN SEEDER
// ===================================
// Idempotently ensures the admin user (configured via .env) exists in the
// `users` sheet. Safe to call on every login — does nothing if the row
// already exists.

import crypto from 'crypto';
import { createRowWithId, listRowsBySheet } from '@/app/lib/supabase';
import { hashPassword } from '@/lib/auth';

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

  const rows = await listRowsBySheet(spreadsheetId, 'users');
  const existing = rows.find(
    (r) => String(r.email ?? '').trim().toLowerCase() === cfg.email,
  );
  if (existing) return { seeded: false };

  const { hash, salt } = await hashPassword(cfg.password);
  await createRowWithId(spreadsheetId, 'users', {
    id: crypto.randomUUID(),
    email: cfg.email,
    name: cfg.name,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  });
  return { seeded: true };
}
