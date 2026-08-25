'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProfileLayout } from '@/components/profile/ProfileLayout';

export function ProfilePageClient() {
  const { isAuthenticated, hydrated } = useAuth();
  const router = useRouter();

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

  return <ProfileLayout />;
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