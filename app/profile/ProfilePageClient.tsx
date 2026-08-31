'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/admin';
import { ProfileLayout } from '@/components/profile/ProfileLayout';

function ProfilePageClientInner() {
  const { isAuthenticated, hydrated, user: authUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = isAdminEmail(authUser?.email);

  // Admins can view another user's profile via ?user=<email>.
  // Non-admins never see this — the API will silently ignore the param.
  const rawUser = searchParams.get('user')?.trim().toLowerCase() || null;
  // Always normalize the auth user's email to lowercase so downstream
  // case-sensitive comparisons (`viewingEmail !== user.email`) behave
  // correctly even if the sheet returned mixed-case data at login.
  const selfEmailLower = authUser?.email?.trim().toLowerCase() ?? null;
  const viewingEmail =
    isAdmin && rawUser && rawUser !== selfEmailLower ? rawUser : selfEmailLower;

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login?next=/profile');
    }
  }, [hydrated, isAuthenticated, router]);

  // Show skeleton until hydration completes.
  if (!hydrated) {
    return <ProfileSkeleton />;
  }

  // If not authed, render nothing while the redirect happens.
  if (!isAuthenticated) {
    return <ProfileSkeleton />;
  }

  return (
    <ProfileLayout
      isAdmin={isAdmin}
      viewingEmail={viewingEmail}
      selfEmail={authUser?.email ?? null}
    />
  );
}

export function ProfilePageClient() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfilePageClientInner />
    </Suspense>
  );
}

function ProfileSkeleton() {
  return (
    <div className="container-base section-padding" aria-busy="true">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        <div className="rounded-2xl bg-off-white p-8 animate-pulse h-[420px]" />
        <div className="flex flex-col gap-8">
          <div className="rounded-2xl bg-off-white p-8 animate-pulse h-[340px]" />
          <div className="rounded-2xl bg-off-white p-8 animate-pulse h-[320px]" />
          <div className="rounded-2xl bg-off-white p-8 animate-pulse h-[420px]" />
        </div>
      </div>
    </div>
  );
}