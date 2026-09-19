// ============================================
// /api/profile/badges/catalog — public badge catalog
// ============================================
//
// GET → list non-archived catalog entries (public, no auth required)
// Used by profile AchievementsGrid to show all available badges.
//
// Returns { badges: BadgeCatalogRecord[] }

import { NextResponse } from 'next/server';
import { listBadgeCatalog } from '@/lib/tennis-level-store';

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const badges = await listBadgeCatalog();
    // Only return non-archived badges for public view
    const publicBadges = badges.filter((b) => !b.archived);
    return NextResponse.json({ badges: publicBadges });
  } catch (error) {
    console.error('Error in GET /api/profile/badges/catalog:', error);
    return serverError('Failed to load badge catalog');
  }
}