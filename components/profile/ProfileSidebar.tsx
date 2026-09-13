'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProfileUser } from '@/data/profile-types';
import { setAuthUser, useAuth } from '@/hooks/useAuth';
import { PencilIcon } from '@/components/ui/Icons';

type Props = {
  user: ProfileUser;
};

const MAX_DIMENSION = 256; // Resize to fit a 256×256 box so the base64
                           // payload stays under the server's 200 KB cap.
const JPEG_QUALITY = 0.85;

// Ordered, low → high. Renders as a <select> with a trailing "Custom"
// entry that opens a free-text input for labels outside the ladder.
const RANK_OPTIONS = [
  'Newbie',
  'Lower Beginner',
  'Beginner',
  'Upper Beginner',
  'Lower Intermediate',
  'Intermediate',
  'Upper Intermediate',
  'Lower Advance',
  'Advance',
  'Expert',
] as const;

const RANK_CUSTOM = '__custom__';

type Tab = 'url' | 'upload' | 'camera';
type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

/**
 * Resize + recompress an image File/Blob to a JPEG data URL. Works for any
 * source the browser can decode (photo uploads, camera frames, fetched
 * images). Returns null if the source can't be decoded.
 */
async function compressToDataUrl(source: Blob | string): Promise<string | null> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image failed to load'));
      el.src = url;
    });
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return null;
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

/**
 * Left-column sidebar: avatar (with photo editor), name, rank, stat tiles.
 * The avatar is editable when the visitor is signed in — the photo editor
 * lets the user paste a URL, upload a file, or take a picture with the
 * camera. The resulting image is compressed and stored as a base64 data
 * URL on the users sheet via PATCH /api/profile.
 */
export function ProfileSidebar({ user, readOnly = false, loading = false }: Props & { readOnly?: boolean; loading?: boolean }) {
  const { name, rank, avatarUrl, stats } = user;
  const { user: authUser } = useAuth();
  // The auth record's `rank` is the source of truth for the signed-in
  // user once they have edited it. For an admin "view as" (readOnly),
  // always use the rank from the `user` prop (the viewed user's record)
  // — `authUser` is the admin, so its rank is wrong here.
  const displayRank = readOnly
    ? (rank ?? authUser?.rank ?? '')
    : (authUser?.rank ?? rank ?? '');
  // Same source-of-truth rule as rank: view-as uses the viewed user's
  // record, self-edit uses the auth record.
  const displayPhone = readOnly ? user.phone : authUser?.phone;
  const [editorOpen, setEditorOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('url');
  const [urlInput, setUrlInput] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [streamReady, setStreamReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Inline name + rank editor. Separate from the photo modal so the
  // two flows don't share state.
  const [profileEditing, setProfileEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [rankDraft, setRankDraft] = useState(displayRank);
  const [phoneDraft, setPhoneDraft] = useState(authUser?.phone ?? '');
  const [profileStatus, setProfileStatus] = useState<Status>({ kind: 'idle' });
  // WhatsApp OTP: requested after saving a (new) phone, verified inline.
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpStatus, setOtpStatus] = useState<Status>({ kind: 'idle' });

  // RANK_OPTIONS / RANK_CUSTOM live at module scope. The <select> needs
  // a controlled value that matches one of its <option>s, so when the
  // current draft is a free-form string (legacy rank or in-progress
  // "Custom" entry) we surface RANK_CUSTOM as the selected option.
  const isLadderRank = (RANK_OPTIONS as readonly string[]).includes(rankDraft);
  const rankSelectValue = rankDraft && !isLadderRank ? RANK_CUSTOM : rankDraft;

  useEffect(() => {
    if (!profileEditing) {
      setNameDraft(name);
      setRankDraft(displayRank);
      setPhoneDraft(authUser?.phone ?? '');
      setOtpSent(false);
      setOtpCode('');
      setOtpStatus({ kind: 'idle' });
    }
  }, [name, displayRank, authUser?.phone, profileEditing]);

  const requestOtp = async () => {
    if (!authUser) return;
    setOtpBusy(true);
    setOtpStatus({ kind: 'idle' });
    try {
      const res = await fetch('/api/phone-verification', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': authUser.email,
        },
        body: JSON.stringify({ phone: phoneDraft.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setOtpSent(true);
      setOtpStatus({ kind: 'idle' });
    } catch (e) {
      setOtpStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal mengirim kode',
      });
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!authUser) return;
    setOtpBusy(true);
    try {
      const res = await fetch('/api/phone-verification', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': authUser.email,
        },
        body: JSON.stringify({ phone: phoneDraft.trim(), code: otpCode.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setOtpStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setOtpStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal verifikasi',
      });
    } finally {
      setOtpBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!authUser) return;
    const nextName = nameDraft.trim();
    const nextRank = rankDraft.trim();
    const nextPhone = phoneDraft.trim();
    if (nextName.length === 0) {
      setProfileStatus({ kind: 'error', message: 'Nama tidak boleh kosong' });
      return;
    }
    setProfileStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': authUser.email,
        },
        body: JSON.stringify({ name: nextName, rank: nextRank, phone: nextPhone }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setAuthUser({ ...authUser, name: nextName, rank: nextRank || undefined, phone: nextPhone || undefined });
      setProfileStatus({ kind: 'saved', at: Date.now() });
      setTimeout(() => {
        setProfileEditing(false);
        setProfileStatus({ kind: 'idle' });
      }, 500);
    } catch (e) {
      setProfileStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal menyimpan profil',
      });
    }
  };
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setStreamReady(false);
  };

  useEffect(() => {
    if (!editorOpen) stopStream();
    return () => stopStream();
  }, [editorOpen]);

  const startCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setStatus({ kind: 'error', message: 'Camera tidak tersedia di browser ini' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setStreamReady(true);
      // Wait a tick for the <video> to mount before attaching.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal membuka kamera',
      });
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !streamReady) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    stopStream();
    void savePhoto(dataUrl);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus({ kind: 'error', message: 'File harus berupa gambar' });
      return;
    }
    setStatus({ kind: 'saving' });
    const dataUrl = await compressToDataUrl(file);
    if (!dataUrl) {
      setStatus({ kind: 'error', message: 'Gagal memproses gambar' });
      return;
    }
    void savePhoto(dataUrl);
  };

  const handleUrlSave = async () => {
    const url = urlInput.trim();
    if (!url) {
      setStatus({ kind: 'error', message: 'URL tidak boleh kosong' });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setStatus({ kind: 'error', message: 'URL harus diawali http:// atau https://' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      // Fetch through our own server to bypass CORS, then resize on canvas.
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const dataUrl = await compressToDataUrl(blob);
      if (!dataUrl) throw new Error('Gagal memproses gambar');
      void savePhoto(dataUrl);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal mengambil gambar',
      });
    }
  };

  const savePhoto = async (dataUrl: string) => {
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': authUser?.email ?? '',
        },
        body: JSON.stringify({ photo: dataUrl }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setAuthUser({ ...(authUser ?? { id: '', email: '', name: '' }), photo: dataUrl });
      setStatus({ kind: 'saved', at: Date.now() });
      setTimeout(() => {
        setEditorOpen(false);
        setStatus({ kind: 'idle' });
        setUrlInput('');
      }, 600);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal menyimpan foto',
      });
    }
  };

  const removePhoto = async () => {
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': authUser?.email ?? '',
        },
        body: JSON.stringify({ photo: null }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (authUser) setAuthUser({ ...authUser, photo: undefined });
      setStatus({ kind: 'saved', at: Date.now() });
      setTimeout(() => {
        setEditorOpen(false);
        setStatus({ kind: 'idle' });
      }, 400);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal menghapus foto',
      });
    }
  };

  return (
    <aside className="bg-white rounded-2xl shadow-md p-6 lg:p-8 sticky top-24 self-start">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <img
            src={avatarUrl}
            alt={name}
            className="w-32 h-32 rounded-full object-cover border-4 border-hunter-green shadow-md"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-hunter-green text-white flex items-center justify-center text-xs font-bold border-2 border-white"
          >
            ✓
          </span>
        </div>

        {profileEditing ? (
          <div className="mt-4 flex w-full flex-col gap-2">
            <label className="flex flex-col gap-1 text-left">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                Nama
              </span>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={80}
                className="rounded-lg border border-light-gray bg-white px-3 py-1.5 text-sm focus:border-hunter-green focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-left">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                Rank
              </span>
              <select
                value={rankSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === RANK_CUSTOM) {
                    // Preserve any existing custom text; otherwise start blank.
                    setRankDraft(isLadderRank ? '' : rankDraft);
                  } else {
                    setRankDraft(v);
                  }
                }}
                className="rounded-lg border border-light-gray bg-white px-3 py-1.5 text-sm focus:border-hunter-green focus:outline-none"
              >
                <option value="" disabled>
                  Pilih rank...
                </option>
                {RANK_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value={RANK_CUSTOM}>Custom...</option>
              </select>
              {!isLadderRank && rankDraft !== '' && (
                <input
                  type="text"
                  value={rankDraft}
                  onChange={(e) => setRankDraft(e.target.value)}
                  placeholder="e.g. 3.5 NTRP"
                  maxLength={60}
                  className="mt-1 rounded-lg border border-light-gray bg-white px-3 py-1.5 text-sm focus:border-hunter-green focus:outline-none"
                />
              )}
            </label>
            <label className="flex flex-col gap-1 text-left">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                Nomor Telepon
              </span>
              <input
                type="tel"
                value={phoneDraft}
                onChange={(e) => {
                  setPhoneDraft(e.target.value);
                  setOtpSent(false);
                  setOtpStatus({ kind: 'idle' });
                }}
                maxLength={20}
                className="rounded-lg border border-light-gray bg-white px-3 py-1.5 text-sm focus:border-hunter-green focus:outline-none"
                placeholder="e.g. +62 812 3456 7890"
              />
            </label>
            <div className="flex flex-col gap-1 text-left">
              <button
                type="button"
                onClick={requestOtp}
                disabled={otpBusy || !phoneDraft.trim()}
                className="self-start rounded-full border border-hunter-green px-3 py-1 text-[0.7rem] font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white disabled:opacity-50"
              >
                {otpBusy && !otpSent ? 'Mengirim…' : otpSent ? 'Kirim ulang kode' : 'Verifikasi nomor (WA)'}
              </button>
              {otpSent && (
                <div className="flex flex-wrap items-center gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    placeholder="Kode OTP"
                    className="w-24 rounded-lg border border-light-gray bg-white px-3 py-1.5 text-sm tracking-widest focus:border-hunter-green focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={otpBusy || otpCode.length !== 6}
                    className="rounded-full bg-paprika px-3 py-1 text-[0.7rem] font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
                  >
                    Verifikasi
                  </button>
                </div>
              )}
              {otpStatus.kind === 'error' && (
                <p className="text-xs text-paprika">{otpStatus.message}</p>
              )}
              {otpStatus.kind === 'saved' && (
                <p className="text-xs text-hunter-green">Nomor terverifikasi ✓</p>
              )}
            </div>
            {profileStatus.kind === 'error' && (
              <p className="text-xs text-paprika">{profileStatus.message}</p>
            )}
            {profileStatus.kind === 'saved' && (
              <p className="text-xs text-hunter-green">Tersimpan</p>
            )}
            <div className="mt-1 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setProfileEditing(false);
                  setProfileStatus({ kind: 'idle' });
                }}
                className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-dark-gray"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={profileStatus.kind === 'saving'}
                className="rounded-full bg-paprika px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
              >
                {profileStatus.kind === 'saving' ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-4 font-serif text-2xl font-semibold text-hunter-green">
              {name}
            </h1>
            <p className="mt-1 text-sm font-medium text-paprika">
              {displayRank}
            </p>
            {displayPhone && (
              <p className="mt-0.5 text-sm text-dark-gray">{displayPhone}</p>
            )}
          </>
        )}

        {authUser && !profileEditing && !readOnly && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setProfileEditing(true)}
              className="inline-flex items-center gap-1 rounded-full border border-hunter-green px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
            >
              <PencilIcon size={12} />
              Edit nama & rank
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="rounded-full border border-hunter-green px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
            >
              Ganti foto
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4" aria-busy={loading}>
        <div className="rounded-xl bg-off-white p-4">
          {loading ? (
            <StatTileSkeleton label="Sessions" />
          ) : (
            <>
              <span className="stat-tile-value">{stats.sessions}</span>
              <span className="stat-tile-label">Sessions</span>
            </>
          )}
        </div>
        <div className="rounded-xl bg-off-white p-4">
          {loading ? (
            <StatTileSkeleton label="Hours" />
          ) : (
            <>
              <span className="stat-tile-value">{stats.hours}</span>
              <span className="stat-tile-label">Hours</span>
            </>
          )}
        </div>
        <div className="rounded-xl bg-off-white p-4 col-span-2">
          {loading ? (
            <StatTileSkeleton label="Badges" />
          ) : (
            <>
              <span className="stat-tile-value">{stats.badges}</span>
              <span className="stat-tile-label">Badges</span>
            </>
          )}
        </div>
      </div>

      {editorOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-graphite/50 sm:items-center sm:p-6"
          onClick={() => setEditorOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Edit foto profil"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-light-gray px-5 py-4">
              <h3 className="font-serif text-lg font-semibold text-hunter-green">
                Edit foto profil
              </h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b border-light-gray">
              {(['url', 'upload', 'camera'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setStatus({ kind: 'idle' });
                  }}
                  className={[
                    'flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                    tab === t
                      ? 'border-b-2 border-paprika text-paprika'
                      : 'text-dark-gray hover:bg-off-white',
                  ].join(' ')}
                >
                  {t === 'url' ? 'URL' : t === 'upload' ? 'Upload' : 'Kamera'}
                </button>
              ))}
            </div>

            <div className="space-y-3 px-5 py-4">
              {tab === 'url' && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                      URL gambar
                    </span>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleUrlSave}
                    disabled={status.kind === 'saving'}
                    className="w-full rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
                  >
                    {status.kind === 'saving' ? 'Mengambil...' : 'Ambil dari URL'}
                  </button>
                </>
              )}

              {tab === 'upload' && (
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                    Pilih foto dari perangkat
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                      e.currentTarget.value = '';
                    }}
                    className="block w-full text-sm text-dark-gray file:mr-3 file:rounded-full file:border-0 file:bg-hunter-green file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-hunter-green-dark"
                  />
                </label>
              )}

              {tab === 'camera' && (
                <div className="flex flex-col gap-3">
                  {streamReady ? (
                    <>
                      <video
                        ref={videoRef}
                        className="w-full rounded-lg border border-light-gray bg-graphite"
                        playsInline
                        muted
                      />
                      <button
                        type="button"
                        onClick={captureFromCamera}
                        className="rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
                      >
                        Ambil foto
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="rounded-full bg-hunter-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-hunter-green-dark"
                    >
                      Buka kamera
                    </button>
                  )}
                </div>
              )}

              {status.kind === 'error' && (
                <p className="text-sm text-paprika">{status.message}</p>
              )}
              {status.kind === 'saved' && (
                <p className="text-sm text-hunter-green">Tersimpan</p>
              )}

              {authUser?.photo && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={status.kind === 'saving'}
                  className="w-full rounded-full border border-paprika px-4 py-2 text-sm font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white disabled:opacity-50"
                >
                  Hapus foto
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </aside>
  );
}

function StatTileSkeleton({ label }: { label: string }) {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="h-7 w-12 rounded bg-light-gray" />
      <div className="mt-2 h-2 w-16 rounded bg-light-gray/70" />
      <span className="sr-only">{`Memuat ${label}`}</span>
    </div>
  );
}
