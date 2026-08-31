// ============================================
// /api/admin/activity-performance — per-activity performance points
// ============================================
//
// GET  ?activity=<id>      → { members: [{ email, name?, rows }] }
//                              `rows` is keyed by skill; each entry is the
//                              current per-(user, activity, skill) row
//                              (with target + kesalahan), or null.
//
// POST { activityId, deltas: { email: { skill: { target?, kesalahan? } } } }
//                            → applies +/- deltas to each affected
//                              (user, skill) row in one batch. Clamps
//                              0-100 server-side.
//
// Both endpoints require `x-auth-email` matching ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  applyActivityPerformanceDeltas,
  getPerformanceForActivity,
  sanitiseDeltas,
  type ActivityPerformanceDeltaInput,
} from '@/lib/user-performance-store';
import { listSignupsForAdmin } from '@/lib/activity-signups-store';
import {
  PERFORMANCE_SKILL_KEYS,
  type PerformanceSkillKey,
} from '@/data/user-performance-types';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const url = new URL(request.url);
  const activityId = url.searchParams.get('activity')?.trim();
  if (!activityId) return badRequest('activity query param is required');

  try {
    const signupsPage = await listSignupsForAdmin({
      page: 1,
      pageSize: 100,
      status: 'approved',
      activityId,
    });
    const memberEmails = signupsPage.items.map((s) => s.userEmail);
    const memberPoints = await getPerformanceForActivity(activityId, memberEmails);

    const lookup = new Map(
      signupsPage.items.map((s) => [s.userEmail.toLowerCase(), s.userName]),
    );
    const members = memberPoints.map((m) => {
      const rows = {} as Record<
        PerformanceSkillKey,
        {
          target: number;
          kesalahan: number;
          updatedAt: string | null;
          updatedBy: string | null;
        } | null
      >;
      for (const skill of PERFORMANCE_SKILL_KEYS) {
        const r = m.rows[skill];
        rows[skill] = r
          ? {
              target: r.target,
              kesalahan: r.kesalahan,
              updatedAt: r.updatedAt ?? null,
              updatedBy: r.updatedBy ?? null,
            }
          : null;
      }
      return {
        email: m.userEmail,
        name: lookup.get(m.userEmail.toLowerCase()) ?? m.userEmail,
        rows,
      };
    });

    return NextResponse.json({ activityId, members });
  } catch (error) {
    console.error('Error in GET /api/admin/activity-performance:', error);
    return serverError('Failed to load activity performance');
  }
}

type PostBody = {
  activityId: string;
  deltas: ActivityPerformanceDeltaInput;
};

export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body || typeof body.activityId !== 'string' || !body.activityId.trim()) {
    return badRequest('activityId is required');
  }

  const parsed = sanitiseDeltas(body.deltas);
  if (!parsed.ok) return badRequest(parsed.error);
  if (Object.keys(parsed.deltas).length === 0) {
    return badRequest('deltas must include at least one user');
  }

  try {
    const result = await applyActivityPerformanceDeltas(
      body.activityId,
      body.deltas,
      email ?? '',
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error in POST /api/admin/activity-performance:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to update performance',
    );
  }
}
