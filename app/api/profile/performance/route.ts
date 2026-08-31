// ============================================
// /api/profile/performance
// ============================================
//
// GET → {
//   labels: SkillKey[5],
//   target: number[5],
//   kesalahan: number[5],
//   activities: number,
// } | null
//
// If activityId query param is provided, returns performance for that
// specific activity (no averaging). Otherwise averages across all activities
// (per-skill denominator; missing skills stay at 0). Returns `null` when
// the user has no rows so the chart can show a placeholder.

import { NextResponse } from 'next/server';
import { getPerformanceForUser, getPerformanceForActivity } from '@/lib/user-performance-store';
import { PERFORMANCE_DISPLAY_ORDER } from '@/data/user-performance-types';
import { isAdminEmail } from '@/lib/admin';

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
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('activityId')?.trim() || null;

  // Admins can view any user's performance by passing ?user=<email>.
  // Non-admins may only view their own — ignore the param in that case.
  const requestedUser = searchParams.get('user')?.trim().toLowerCase() || null;
  const targetEmail =
    requestedUser && isAdminEmail(email) ? requestedUser : email;

  try {
    if (activityId) {
      const result = await getPerformanceForActivity(activityId, [targetEmail]);
      const member = result[0];
      if (!member) {
        return NextResponse.json(null);
      }
      const labels = [...PERFORMANCE_DISPLAY_ORDER];
      const target = labels.map((s) => member.rows[s]?.target ?? 0);
      const kesalahan = labels.map((s) => member.rows[s]?.kesalahan ?? 0);
      return NextResponse.json({
        labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
        target,
        kesalahan,
        activities: 1,
      });
    }

    const total = await getPerformanceForUser(targetEmail);
    if (!total) {
      return NextResponse.json(null);
    }
    return NextResponse.json({
      labels: total.labels,
      target: total.target,
      kesalahan: total.kesalahan,
      activities: total.activityCount,
    });
  } catch (error) {
    console.error('Error in GET /api/profile/performance:', error);
    return serverError('Failed to load performance');
  }
}
