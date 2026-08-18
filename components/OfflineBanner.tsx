'use client';

import { useEffect, useState } from 'react';
import { startAutoFlush, pending, type FlushResult } from '@/lib/offline-queue';

/**
 * Persistent indicator of queued writes. Without this, "saved" is a lie the
 * staff member has no way to check.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    pending().then((p) => setQueued(p.length));

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    const stop = startAutoFlush((r: FlushResult) => setQueued(r.remaining));

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      stop();
    };
  }, []);

  if (online && queued === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-40 px-4 py-2 text-center text-sm font-medium ${
        online ? 'bg-amber-100 text-amber-900' : 'bg-slate-800 text-white'
      }`}
    >
      {online
        ? `Sending ${queued} saved ${queued === 1 ? 'entry' : 'entries'}…`
        : `Offline — ${queued} ${queued === 1 ? 'entry' : 'entries'} saved on this device`}
    </div>
  );
}
