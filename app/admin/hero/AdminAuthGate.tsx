'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/admin';

type Props = {
  children: React.ReactNode;
};

export function AdminAuthGate({ children }: Props) {
  const { user, isAuthenticated, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login?next=/admin/hero');
      return;
    }
    if (!isAdminEmail(user?.email)) {
      router.replace('/');
    }
  }, [hydrated, isAuthenticated, user?.email, router]);

  if (!hydrated) {
    return <AdminSkeleton message="Memuat..." />;
  }
  if (!isAuthenticated) {
    return <AdminSkeleton message="Mengalihkan ke login..." />;
  }
  if (!isAdminEmail(user?.email)) {
    return <AdminSkeleton message="Hanya admin yang bisa membuka halaman ini." />;
  }
  return <>{children}</>;
}

function AdminSkeleton({ message }: { message: string }) {
  return (
    <div className="container-base section-padding" aria-busy="true">
      <div className="mx-auto max-w-3xl">
        <div className="h-8 w-48 rounded-md bg-light-gray animate-pulse" />
        <div className="mt-6 h-64 rounded-2xl bg-off-white animate-pulse" />
      </div>
      <p className="mt-6 text-center text-sm text-dark-gray">{message}</p>
    </div>
  );
}
