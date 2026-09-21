'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronUp,
  PlusIcon,
  XIcon,
} from '@/components/ui/Icons';
import {
  UsersIcon,
  LightningIcon,
  CalendarIcon,
  LayersIcon,
  ClockIcon,
  HeartIcon,
  TrophyIcon,
  StarIcon,
  TargetIcon,
  SparklesIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import type {
  BenefitIconKey,
  BenefitItem,
  WhyJoinContent,
  WhyJoinSettings,
} from '@/data/why-join-types';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';

const ICON_PICKER: Array<{ key: BenefitIconKey; label: string; Icon: typeof UsersIcon }> = [
  { key: 'users', label: 'Users', Icon: UsersIcon },
  { key: 'lightning', label: 'Lightning', Icon: LightningIcon },
  { key: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { key: 'layers', label: 'Layers', Icon: LayersIcon },
  { key: 'clock', label: 'Clock', Icon: ClockIcon },
  { key: 'heart', label: 'Heart', Icon: HeartIcon },
  { key: 'trophy', label: 'Trophy', Icon: TrophyIcon },
  { key: 'star', label: 'Star', Icon: StarIcon },
  { key: 'target', label: 'Target', Icon: TargetIcon },
  { key: 'sparkles', label: 'Sparkles', Icon: SparklesIcon },
];

type SettingsDraft = Omit<WhyJoinSettings, 'id' | 'updatedAt'>;

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DRAFT_KEY = 'admin.why-join.draft';

type Draft = { settings: SettingsDraft; benefits: BenefitItem[] };

function readDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  if (typeof window === 'undefined') return;
  if (draft) {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } else {
    window.localStorage.removeItem(DRAFT_KEY);
  }
}

function isPersistedBenefitId(id: string) {
  return id.length > 24;
}

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

function IconPicker({ value, onChange }: { value: BenefitIconKey; onChange: (key: BenefitIconKey) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    if (rect.right > viewportWidth - 8) {
      dropdownRef.current.style.left = 'auto';
      dropdownRef.current.style.right = '0';
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full rounded-lg border border-light-gray bg-white px-2 py-1.5 text-left text-sm hover:border-hunter-green focus:border-hunter-green focus:outline-none"
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        <span className="capitalize">{value}</span>
      </button>
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-56 max-h-48 overflow-y-auto rounded-xl border border-light-gray bg-white shadow-xl left-0 text-left"
        >
          {ICON_PICKER.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={[
                'w-full flex items-center justify-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                value === opt.key ? 'bg-hunter-green/5 text-hunter-green' : 'text-dark-gray hover:bg-hunter-green/5',
              ].join(' ')}
            >
              <opt.Icon size={18} className="shrink-0" />
              <span className="capitalize text-base flex-1 min-w-0 text-left">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WhyJoinEditorClient({ initial }: { initial: WhyJoinContent }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsDraft>({
    tag: initial.settings.tag,
    title: initial.settings.title,
    subtitle: initial.settings.subtitle,
  });
  const [benefits, setBenefits] = useState<BenefitItem[]>(initial.benefits);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const d = readDraft();
    if (d) {
      setSettings(d.settings);
      setBenefits(d.benefits);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ settings, benefits });
  }, [hydrated, settings, benefits]);

  const apiFetch = useCallback(
    async (
      kind: 'settings' | 'benefit' | 'reorder' | 'delete',
      payload: Record<string, unknown>,
      method: 'PUT' | 'DELETE' = 'PUT',
    ) => {
      const res = await fetch('/api/why-join', {
        method,
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ kind, ...payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [user?.email],
  );

  const setSettingsField = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setStatus({ kind: 'idle' });
  };

  const addBenefit = () => {
    setBenefits((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: '',
        description: '',
        icon: 'users',
        order: prev.length,
      },
    ]);
    setStatus({ kind: 'idle' });
  };

  const updateBenefit = (id: string, patch: Partial<BenefitItem>) => {
    setBenefits((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
    setStatus({ kind: 'idle' });
  };

  const removeBenefit = async (id: string) => {
    const isPersisted = isPersistedBenefitId(id);
    if (!isPersisted) {
      setBenefits((prev) =>
        prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })),
      );
      setStatus({ kind: 'idle' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('delete', { id }, 'DELETE');
      setBenefits((prev) =>
        prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })),
      );
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    }
  };

  const moveBenefit = (id: string, dir: -1 | 1) => {
    setBenefits((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next.map((b, i) => ({ ...b, order: i }));
    });
    setStatus({ kind: 'idle' });
  };

  const onSaveAll = async () => {
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('settings', { settings });

      const existingIds = new Set(initial.benefits.map((b) => b.id));
      for (const b of benefits) {
        if (b.title.trim().length === 0) continue;
        if (!existingIds.has(b.id)) {
          const result = await apiFetch('benefit', {
            benefit: { title: b.title, description: b.description, icon: b.icon },
          });
          const persisted = (result as { benefit?: BenefitItem }).benefit;
          if (persisted?.id) {
            setBenefits((prev) =>
              prev.map((x) => (x.id === b.id ? { ...x, id: persisted.id } : x)),
            );
          }
        } else {
          await apiFetch('benefit', {
            benefit: {
              id: b.id,
              title: b.title,
              description: b.description,
              icon: b.icon,
            },
          });
        }
      }

      const currentIds = new Set(benefits.map((b) => b.id));
      for (const old of initial.benefits) {
        if (!currentIds.has(old.id) && isPersistedBenefitId(old.id)) {
          await apiFetch('delete', { id: old.id }, 'DELETE');
        }
      }

      const finalIds = benefits
        .filter((b) => b.title.trim().length > 0)
        .map((b) => b.id);
      if (finalIds.length > 0) {
        await apiFetch('reorder', { ids: finalIds });
      }

      setStatus({ kind: 'saved', at: Date.now() });
      writeDraft(null);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
      });
    }
  };

  const filteredBenefits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return benefits;
    return benefits.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    );
  }, [benefits, search]);

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredBenefits.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filteredBenefits.slice(pageStart, pageStart + pageSize);

  const benefitColumns = useMemo(() => [
    {
      key: 'icon',
      header: 'Icon',
      priority: 1 as const,
      className: 'w-20',
      render: (benefit: BenefitItem) => {
        const PickerIcon = ICON_PICKER.find((p) => p.key === benefit.icon)?.Icon ?? UsersIcon;
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-hunter-green to-teal text-white">
              <PickerIcon size={18} />
            </div>
            <IconPicker
              value={benefit.icon}
              onChange={(iconKey) => updateBenefit(benefit.id, { icon: iconKey })}
            />
          </div>
        );
      },
    },
    {
      key: 'title',
      header: 'Judul',
      priority: 1 as const,
      render: (benefit: BenefitItem) => (
        <input
          type="text"
          value={benefit.title}
          onChange={(e) => updateBenefit(benefit.id, { title: e.target.value })}
          className={INPUT_CLS}
          placeholder="Judul benefit"
        />
      ),
    },
    {
      key: 'description',
      header: 'Deskripsi',
      priority: 2 as const,
      render: (benefit: BenefitItem) => (
        <input
          type="text"
          value={benefit.description}
          onChange={(e) => updateBenefit(benefit.id, { description: e.target.value })}
          className={INPUT_CLS}
          placeholder="Deskripsi benefit"
        />
      ),
    },
    {
      key: 'order',
      header: 'Urutan',
      priority: 3 as const,
      className: 'w-20',
      render: (benefit: BenefitItem) => {
        const idx = benefits.findIndex((b) => b.id === benefit.id);
        return <span className="font-mono text-xs text-dark-gray">#{idx + 1}</span>;
      },
    },
  ], [benefits, updateBenefit]);

  const getRowActions = (benefit: BenefitItem) => {
    const idx = benefits.findIndex((b) => b.id === benefit.id);
    return [
      {
        label: '↑',
        primary: false,
        onClick: () => moveBenefit(benefit.id, -1),
        disabled: () => idx === 0,
      },
      {
        label: '↓',
        primary: false,
        onClick: () => moveBenefit(benefit.id, 1),
        disabled: () => idx === benefits.length - 1,
      },
      {
        label: 'Hapus',
        primary: false,
        destructive: true,
        onClick: () => removeBenefit(benefit.id),
      },
    ];
  };

  return (
    <div className="container-base section-padding">
      <header className="admin-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Why Join Editor
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit judul section dan kartu benefit yang tampil di home page
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveBadge status={status} />
          <button
            type="button"
            onClick={onSaveAll}
            disabled={status.kind === 'saving'}
            className="rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-paprika-hover disabled:opacity-50"
          >
            {status.kind === 'saving' ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-hunter-green">
          Heading
        </h2>
        <p className="mt-1 text-sm text-dark-gray">
          Tag, judul, dan subjudul section
        </p>

        <div className="mt-6 admin-form-grid">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Tag</span>
            <input
              type="text"
              value={settings.tag}
              onChange={(e) => setSettingsField('tag', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={FIELD_LABEL_CLS}>Title</span>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettingsField('title', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className={FIELD_LABEL_CLS}>Subtitle</span>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => setSettingsField('subtitle', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Benefits
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Kartu benefit yang tampil di grid 3 kolom
            </p>
          </div>
          <button
            type="button"
            onClick={addBenefit}
            className="inline-flex items-center gap-1.5 rounded-full border border-hunter-green px-3 py-1.5 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            <PlusIcon size={14} />
            Tambah benefit
          </button>
        </header>

        <AdminTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari judul / deskripsi benefit"
          onAdd={addBenefit}
          addLabel="Tambah benefit"
          loading={false}
          pageSize={pageSize}
          onPageSizeChange={changePageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />

        <ResponsiveTable
          items={pageItems}
          rowKey={(b) => b.id}
          columns={benefitColumns}
          actions={getRowActions(pageItems[0])}
          emptyMessage={benefits.length === 0 ? 'Belum ada benefit. Klik "Tambah benefit" untuk mulai.' : 'Tidak ada hasil untuk pencarian ini.'}
          loading={false}
          mobileCardRender={(benefit) => {
            const idx = benefits.findIndex((b) => b.id === benefit.id);
            const PickerIcon = ICON_PICKER.find((p) => p.key === benefit.icon)?.Icon ?? UsersIcon;
            const { primaryActions, secondaryActions } = {
              primaryActions: getRowActions(benefit).filter(a => a.primary),
              secondaryActions: getRowActions(benefit).filter(a => !a.primary)
            };
            return (
              <>
                <div className="admin-card-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-hunter-green to-teal text-white">
                      <PickerIcon size={26} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-hunter-green truncate">{benefit.title || '—'}</h3>
                      <p className="text-xs text-dark-gray">#{idx + 1}</p>
                    </div>
                  </div>
                </div>
                <div className="admin-card-body space-y-3">
                  <div className="admin-card-row flex flex-col items-start gap-1">
                    <span className="admin-card-label">Icon</span>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-hunter-green to-teal text-white">
                        <PickerIcon size={18} />
                      </div>
                      <IconPicker
                        value={benefit.icon}
                        onChange={(iconKey) => updateBenefit(benefit.id, { icon: iconKey })}
                      />
                    </div>
                  </div>
                  <div className="admin-card-row flex flex-col items-start gap-1">
                    <span className="admin-card-label">Judul</span>
                    <input
                      type="text"
                      value={benefit.title}
                      onChange={(e) => updateBenefit(benefit.id, { title: e.target.value })}
                      className={INPUT_CLS}
                      placeholder="Judul benefit"
                    />
                  </div>
                  <div className="admin-card-row flex flex-col items-start gap-1">
                    <span className="admin-card-label">Deskripsi</span>
                    <input
                      type="text"
                      value={benefit.description}
                      onChange={(e) => updateBenefit(benefit.id, { description: e.target.value })}
                      className={INPUT_CLS}
                      placeholder="Deskripsi benefit"
                    />
                  </div>
                </div>
                <div className="admin-card-actions">
                  <button
                    type="button"
                    onClick={() => moveBenefit(benefit.id, -1)}
                    disabled={idx === 0}
                    className="admin-card-action-primary admin-touch-target"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBenefit(benefit.id, 1)}
                    disabled={idx === benefits.length - 1}
                    className="admin-card-action-primary admin-touch-target"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBenefit(benefit.id)}
                    className="admin-card-action-primary admin-card-action-destructive admin-touch-target"
                  >
                    Hapus
                  </button>
                </div>
              </>
            );
          }}
        />

        <ResponsivePagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          showPageNumbers={true}
        />
      </section>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status.kind === 'idle') {
    return (
      <span className="text-xs text-dark-gray">Belum ada perubahan disimpan</span>
    );
  }
  if (status.kind === 'saving') {
    return <span className="text-xs text-dark-gray">Menyimpan...</span>;
  }
  if (status.kind === 'saved') {
    return (
      <span className="rounded-full bg-hunter-green/10 px-3 py-1 text-xs font-semibold text-hunter-green">
        Tersimpan
      </span>
    );
  }
  return (
    <span className="rounded-full bg-paprika/10 px-3 py-1 text-xs font-semibold text-paprika">
      {status.message}
    </span>
  );
}