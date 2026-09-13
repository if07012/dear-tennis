// ============================================
// /api/admin/groq-logs — Groq call log viewer
// ============================================
// GET ?page=&pageSize=&status= → paged newest-first attempt log.
// Admin-gated via x-auth-email + isAdminEmail.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { isGroqLogStatus, listGroqLogs } from '@/lib/groq-store';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

export async function GET(request: Request) {
  if (!isAdminEmail(getRequesterEmail(request))) return unauthorized();

  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1;
  const pageSize = Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20;
  const statusRaw = url.searchParams.get('status')?.trim() ?? '';
  const status = isGroqLogStatus(statusRaw) ? statusRaw : undefined;

  try {
    return NextResponse.json(await listGroqLogs({ page, pageSize, status }));
  } catch (error) {
    console.error('Error in GET /api/admin/groq-logs:', error);
    return serverError('Failed to list logs');
  }
}
