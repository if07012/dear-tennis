'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { eventHistory as staticHistory, chipEmojis, chipPalette } from '@/data/profile';
import type { FilterableEvent } from '@/data/profile-types';
import { ImageIcon } from '@/components/ui/Icons';
import { Lightbox } from './Lightbox';

type PhotoRef = {
  eventId: string;
  eventTitle: string;
  url: string;
};

const PAGE_SIZE = 8;

export function EventGallery({
  viewingEmail,
}: {
  viewingEmail: string | null;
}) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    index: number;
    title: string;
  } | null>(null);
  const [joinedEvents, setJoinedEvents] = useState<FilterableEvent[] | null>(null);

  // When admin is viewing another user, fetch their joined activities so
  // the gallery reflects that user's events. For the default view we keep
  // the static `eventHistory` so the original visual is preserved.
  useEffect(() => {
    if (!user?.email) return;
    if (!viewingEmail || viewingEmail === user.email) {
      setJoinedEvents(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/profile/joined-activities?user=${encodeURIComponent(viewingEmail)}`,
          { headers: { 'x-auth-email': user.email }, signal: controller.signal },
        );
        if (!res.ok) {
          setJoinedEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: FilterableEvent[] };
        setJoinedEvents(body.events ?? []);
      } catch {
        setJoinedEvents([]);
      }
    })();
    return () => controller.abort();
  }, [user?.email, viewingEmail]);

  const eventsToShow = joinedEvents ?? staticHistory;

  const allPhotos = useMemo<PhotoRef[]>(() => {
    const photos: PhotoRef[] = [];
    for (const evt of eventsToShow) {
      for (const url of evt.photos) {
        photos.push({ eventId: evt.id, eventTitle: evt.title, url });
      }
    }
    return photos;
  }, [eventsToShow]);

  const shown = allPhotos.slice(0, visible);
  const hasMore = allPhotos.length > visible;

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="profile-section-icon" aria-hidden="true">
          <ImageIcon />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-hunter-green">
            Event Gallery
          </h2>
          <p className="text-sm text-dark-gray">
            Momen terbaik dari setiap pertandingan
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((photo, idx) => {
          const palette = chipPalette[photo.eventId];
          const emoji = chipEmojis[photo.eventId];
          return (
            <button
              key={`${photo.eventId}-${idx}`}
              type="button"
              onClick={() => {
                const event = eventsToShow.find((e) => e.id === photo.eventId);
                if (!event) return;
                const eventIndex = event.photos.indexOf(photo.url);
                setLightbox({
                  photos: event.photos,
                  index: eventIndex >= 0 ? eventIndex : 0,
                  title: event.title,
                });
              }}
              className="gallery-item group relative aspect-square overflow-hidden rounded-xl border border-light-gray bg-off-white text-left transition-shadow hover:shadow-md"
            >
              {photo.url ? (
                <img
                  src={photo.url}
                  alt={`${photo.eventTitle} photo ${idx + 1}`}
                  className="gallery-image h-full w-full object-cover transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl text-dark-gray">
                  📷
                </div>
              )}
              <div className="gallery-overlay absolute inset-0 flex flex-col items-start justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-300">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${palette?.bg ?? 'bg-white/20'} ${palette?.text ?? 'text-white'} backdrop-blur`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  {photo.eventTitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-hunter-green px-5 py-2 text-sm font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            Load more photos
          </button>
        </div>
      )}

      <Lightbox
        open={lightbox !== null}
        photos={lightbox?.photos ?? []}
        index={lightbox?.index ?? 0}
        title={lightbox?.title}
        onClose={() => setLightbox(null)}
        onPrev={() =>
          setLightbox((prev) =>
            prev
              ? {
                  ...prev,
                  index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
                }
              : prev,
          )
        }
        onNext={() =>
          setLightbox((prev) =>
            prev
              ? {
                  ...prev,
                  index: (prev.index + 1) % prev.photos.length,
                }
              : prev,
          )
        }
      />
    </section>
  );
}