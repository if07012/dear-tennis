'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { setAuthUser } from '@/hooks/useAuth';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type InviteStatus = 'pending' | 'sent' | 'accepted' | 'cancelled';

type InviteLookup = {
  email: string;
  name?: string;
  status: InviteStatus;
};

type State =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'cancelled' }
  | { kind: 'accepted' }
  | { kind: 'form'; invite: InviteLookup }
  | { kind: 'submitting'; invite: InviteLookup }
  | { kind: 'success'; email: string; name: string };

type FieldErrors = {
  name?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  form?: string;
};

function mapStatusToState(
  invite: InviteLookup,
): Extract<State, { kind: 'form' | 'accepted' | 'cancelled' }> {
  if (invite.status === 'accepted') return { kind: 'accepted' };
  if (invite.status === 'cancelled') return { kind: 'cancelled' };
  return { kind: 'form', invite };
}

export function AcceptInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invite/${encodeURIComponent(token)}`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: 'not_found' });
          return;
        }
        if (!res.ok) {
          setState({ kind: 'not_found' });
          return;
        }
        const body = (await res.json()) as InviteLookup;
        setState(mapStatusToState(body));
      } catch {
        if (!cancelled) setState({ kind: 'not_found' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-off-white">
      <div className="container-base flex min-h-screen items-center justify-center py-16">
        <div className="w-full max-w-md">
          <header className="mb-8 text-center">
            <Link
              href="/"
              className="font-serif text-2xl font-bold text-hunter-green"
            >
              Dear Tennis
            </Link>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-paprika">
              Undangan Member
            </p>
          </header>

          <div className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
            {state.kind === 'loading' && <LoadingState />}
            {state.kind === 'not_found' && <NotFoundState />}
            {state.kind === 'accepted' && <AcceptedState />}
            {state.kind === 'cancelled' && <CancelledState />}
            {(state.kind === 'form' || state.kind === 'submitting') && (
              <FormState
                token={token}
                invite={state.invite}
                submitting={state.kind === 'submitting'}
                onSubmit={async (values) => {
                  setState({ kind: 'submitting', invite: state.invite });
                  try {
                    const res = await fetch(
                      `/api/invite/${encodeURIComponent(token)}/accept`,
                      {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify(values),
                      },
                    );
                    const body = (await res
                      .json()
                      .catch(() => ({}))) as {
                      success?: boolean;
                      error?: string;
                      user?: { id: string; email: string; name: string; phone?: string };
                    };
                    if (!res.ok || !body.success || !body.user) {
                      setState({ kind: 'form', invite: state.invite });
                      return {
                        form: body.error ?? `HTTP ${res.status}`,
                      } satisfies FieldErrors;
                    }
                    setAuthUser(body.user);
                    setState({
                      kind: 'success',
                      email: body.user.email,
                      name: body.user.name,
                    });
                    return null;
                  } catch (e) {
                    setState({ kind: 'form', invite: state.invite });
                    return {
                      form:
                        e instanceof Error
                          ? e.message
                          : 'Gagal menghubungi server',
                    } satisfies FieldErrors;
                  }
                }}
                onSuccessRedirect={() => router.push('/profile')}
              />
            )}
            {state.kind === 'success' && (
              <SuccessState
                email={state.email}
                name={state.name}
                onContinue={() => router.push('/profile')}
              />
            )}
          </div>

          <p className="mt-6 text-center text-xs text-dark-gray">
            <Link href="/" className="transition-colors hover:text-hunter-green">
              ← Kembali ke beranda
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-light-gray border-t-hunter-green" />
      <p className="text-sm text-dark-gray">Memuat undangan...</p>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="space-y-4 py-6 text-center">
      <h1 className="font-serif text-xl font-semibold text-hunter-green">
        Undangan tidak ditemukan
      </h1>
      <p className="text-sm text-dark-gray">
        Tautan ini tidak valid atau sudah kedaluwarsa. Minta admin mengirim
        undangan baru jika kamu merasa ini keliru.
      </p>
      <Link
        href="/login"
        className="inline-flex rounded-full border border-light-gray px-4 py-2 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green"
      >
        Sudah punya akun? Login
      </Link>
    </div>
  );
}

function AcceptedState() {
  return (
    <div className="space-y-4 py-6 text-center">
      <h1 className="font-serif text-xl font-semibold text-hunter-green">
        Undangan sudah digunakan
      </h1>
      <p className="text-sm text-dark-gray">
        Undangan ini sudah dipakai untuk membuat akun. Silakan login dengan
        email yang sudah terdaftar.
      </p>
      <Link
        href="/login"
        className="inline-flex rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
      >
        Login
      </Link>
    </div>
  );
}

function CancelledState() {
  return (
    <div className="space-y-4 py-6 text-center">
      <h1 className="font-serif text-xl font-semibold text-hunter-green">
        Undangan dibatalkan
      </h1>
      <p className="text-sm text-dark-gray">
        Undangan ini sudah dibatalkan oleh admin. Hubungi admin Dear Tennis
        untuk informasi lebih lanjut.
      </p>
    </div>
  );
}

function SuccessState({
  email,
  name,
  onContinue,
}: {
  email: string;
  name: string;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5 py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-hunter-green/10 text-hunter-green">
        ✓
      </div>
      <h1 className="font-serif text-xl font-semibold text-hunter-green">
        Selamat datang, {name}!
      </h1>
      <p className="text-sm text-dark-gray">
        Akun kamu untuk <span className="font-semibold">{email}</span> sudah
        aktif. Kamu sudah login otomatis.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="inline-flex rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
      >
        Buka dashboard
      </button>
    </div>
  );
}

function FormState({
  invite,
  submitting,
  onSubmit,
  onSuccessRedirect,
  token: _token,
}: {
  token: string;
  invite: InviteLookup;
  submitting: boolean;
  onSubmit: (values: { name: string; phone: string; password: string }) => Promise<FieldErrors | null>;
  onSuccessRedirect: () => void;
}) {
  const [name, setName] = useState(invite.name ?? '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Nama wajib diisi';
    if (phone.trim() && !/^[+\d][\d\s-]{5,}$/.test(phone.trim())) {
      next.phone = 'Nomor telepon tidak valid';
    }
    if (password.length < 6) next.password = 'Password minimal 6 karakter';
    if (confirm !== password) next.confirm = 'Konfirmasi password tidak cocok';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    const result = await onSubmit({ name: name.trim(), phone: phone.trim(), password });
    if (result) {
      setErrors(result);
    } else {
      onSuccessRedirect();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="font-serif text-xl font-semibold text-hunter-green">
          Lengkapi pendaftaran
        </h1>
        <p className="mt-1 text-sm text-dark-gray">
          Buat password untuk akun{' '}
          <span className="font-semibold text-hunter-green">{invite.email}</span>
          .
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLS}>Email</span>
        <input
          type="email"
          value={invite.email}
          disabled
          className={`${INPUT_CLS} cursor-not-allowed bg-off-white text-dark-gray`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLS}>Nama</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          disabled={submitting}
          className={INPUT_CLS}
          placeholder="Nama lengkap"
        />
        {errors.name && (
          <span className="text-xs font-semibold text-paprika">
            {errors.name}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLS}>Nomor Telepon</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          maxLength={20}
          disabled={submitting}
          className={INPUT_CLS}
          placeholder="Opsional, e.g. +62 812 3456 7890"
        />
        {errors.phone && (
          <span className="text-xs font-semibold text-paprika">
            {errors.phone}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLS}>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          className={INPUT_CLS}
          placeholder="Minimal 6 karakter"
        />
        {errors.password && (
          <span className="text-xs font-semibold text-paprika">
            {errors.password}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL_CLS}>Konfirmasi Password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          className={INPUT_CLS}
          placeholder="Ulangi password"
        />
        {errors.confirm && (
          <span className="text-xs font-semibold text-paprika">
            {errors.confirm}
          </span>
        )}
      </label>

      {errors.form && (
        <div
          role="alert"
          className="rounded-lg border border-paprika/30 bg-paprika/10 px-3 py-2 text-xs font-semibold text-paprika"
        >
          {errors.form}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-60"
      >
        {submitting ? 'Membuat akun...' : 'Aktifkan Akun'}
      </button>

      <p className="text-center text-xs text-dark-gray">
        Dengan melanjutkan, kamu menyetujui etika komunitas Dear Tennis.
      </p>
    </form>
  );
}
