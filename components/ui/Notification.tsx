'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type NotificationType = 'success' | 'error' | 'info';

type Notification = {
  id: number;
  message: string;
  type: NotificationType;
};

const ICONS: Record<NotificationType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const COLORS: Record<NotificationType, string> = {
  success: 'bg-hunter-green',
  error: 'bg-paprika',
  info: 'bg-teal',
};

let nextId = 0;

type Listener = (n: Notification) => void;
const listeners = new Set<Listener>();

/** Imperative API: show a notification from anywhere. */
export function showNotification(message: string, type: NotificationType = 'info') {
  const notification: Notification = { id: ++nextId, message, type };
  listeners.forEach((l) => l(notification));
}

export function NotificationHost() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    const listener: Listener = (n) => {
      setItems((prev) => [...prev, n]);
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== n.id));
      }, 4000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div
      className="fixed top-24 right-5 z-50 flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {items.map((n) => (
          <motion.div
            key={n.id}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={[
              'flex items-center gap-3 px-6 py-4 rounded-xl text-white shadow-lg max-w-[350px] pointer-events-auto',
              COLORS[n.type],
            ].join(' ')}
          >
            <span className="text-xl leading-none">{ICONS[n.type]}</span>
            <span className="text-sm">{n.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
