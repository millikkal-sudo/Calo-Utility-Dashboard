'use client';

/**
 * Write-behind queue for the warehouse.
 *
 * Loading bays and cold stores have poor signal, and the Apps Script version
 * simply failed the save when the request didn't land — the staff member typed
 * the entry again later, or didn't. Here every submission is durably queued in
 * IndexedDB first, then flushed. The form can confirm immediately.
 *
 * IndexedDB rather than localStorage: entries carry base64 photos, which blow
 * past the ~5 MB localStorage ceiling quickly.
 */

const DB_NAME = 'calo-utility';
const STORE = 'pending';
const VERSION = 1;

export type PendingWrite = {
  id: string;
  metric: string;
  payload: Record<string, unknown>;
  photo?: string | null;
  queuedAt: number;
  attempts: number;
  lastError?: string;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function enqueue(metric: string, payload: Record<string, unknown>, photo?: string | null) {
  const item: PendingWrite = {
    id: crypto.randomUUID(),
    metric,
    payload,
    photo: photo ?? null,
    queuedAt: Date.now(),
    attempts: 0,
  };
  await tx('readwrite', (s) => s.add(item));
  return item.id;
}

export async function pending(): Promise<PendingWrite[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<PendingWrite[]>);
}

export async function remove(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}

async function update(item: PendingWrite) {
  await tx('readwrite', (s) => s.put(item));
}

/** Result of a flush attempt, so the UI can show what's still stuck. */
export type FlushResult = { sent: number; failed: number; remaining: number };

let flushing = false;

export async function flush(): Promise<FlushResult> {
  if (flushing || !navigator.onLine) {
    return { sent: 0, failed: 0, remaining: (await pending()).length };
  }
  flushing = true;
  let sent = 0;
  let failed = 0;

  try {
    for (const item of await pending()) {
      try {
        const res = await fetch(`/api/log/${item.metric}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item.payload, photo: item.photo, clientId: item.id }),
        });

        if (res.ok) {
          await remove(item.id);
          sent++;
          continue;
        }

        // 4xx means the payload itself is wrong — retrying forever won't fix a
        // meter-continuity violation. Keep it, surface it, stop counting it as
        // transient.
        const body = await res.json().catch(() => ({}));
        item.attempts++;
        item.lastError = body?.error ?? `HTTP ${res.status}`;
        await update(item);
        failed++;
      } catch {
        // Network died mid-flush. Leave it queued and try again on reconnect.
        item.attempts++;
        item.lastError = 'Offline';
        await update(item);
        failed++;
        break;
      }
    }
  } finally {
    flushing = false;
  }

  return { sent, failed, remaining: (await pending()).length };
}

/** Call once from a top-level client component. */
export function startAutoFlush(onChange?: (r: FlushResult) => void) {
  const run = () => flush().then((r) => onChange?.(r));
  window.addEventListener('online', run);
  const timer = setInterval(run, 30_000);
  run();
  return () => {
    window.removeEventListener('online', run);
    clearInterval(timer);
  };
}
