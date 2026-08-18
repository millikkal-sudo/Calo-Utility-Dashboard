'use client';

import { useState } from 'react';
import type { MetricConfig } from '@/lib/metrics';
import { Stepper } from './Stepper';
import { PhotoPicker } from './PhotoPicker';
import { enqueue, flush } from '@/lib/offline-queue';

type Option = { id: string; full_name?: string; label?: string | null };

export function LogForm({
  config, staff, generators,
}: {
  config: MetricConfig;
  staff: Option[];
  generators: Option[];
}) {
  const [values, setValues] = useState<Record<string, string>>(() => initial(config));
  const [photo, setPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'queued' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const required = config.fields.filter((f) => !('optional' in f && f.optional));
  const complete = required.every((f) => values[f.name] !== undefined && values[f.name] !== '');

  async function submit() {
    setBusy(true);
    setStatus(null);
    try {
      // Queue first, then flush. The entry survives a dead connection, an app
      // switch, or a killed browser tab.
      await enqueue(config.slug, values, photo);
      const result = await flush();

      if (result.sent > 0) {
        setStatus({ kind: 'ok', text: 'Saved.' });
        setValues(initial(config));
        setPhoto(null);
      } else if (result.failed > 0) {
        // A 4xx is a real rejection worth showing — most often the
        // meter-continuity check naming the expected reading.
        const stuck = await import('@/lib/offline-queue').then((m) => m.pending());
        const last = stuck.at(-1);
        setStatus({
          kind: 'error',
          text: last?.lastError ?? 'Could not save. It is still queued on this device.',
        });
      } else {
        setStatus({ kind: 'queued', text: 'Saved on this device — will send when you have signal.' });
        setValues(initial(config));
        setPhoto(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const derived = config.derived?.(values);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {config.fields.map((field) => {
        const id = `f_${field.name}`;

        if (field.kind === 'stepper') {
          return (
            <div key={field.name}>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">{field.label}</span>
              <Stepper
                label={field.label}
                min={field.min}
                max={field.max}
                value={Number(values[field.name] || field.min || 1)}
                onChange={(v) => set(field.name, String(v))}
              />
            </div>
          );
        }

        if (field.kind === 'select' || field.kind === 'staff' || field.kind === 'generator') {
          const options =
            field.kind === 'staff'
              ? staff.map((s) => ({ value: s.id, text: s.full_name! }))
              : field.kind === 'generator'
                ? generators.map((g) => ({ value: g.id, text: g.label ? `${g.id} — ${g.label}` : g.id }))
                : field.options.map((o) => ({ value: o, text: o }));

          return (
            <label key={field.name} htmlFor={id} className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">{field.label}</span>
              <select
                id={id}
                value={values[field.name] ?? ''}
                onChange={(e) => set(field.name, e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Select…</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.text}</option>
                ))}
              </select>
            </label>
          );
        }

        const type =
          field.kind === 'date' ? 'date'
          : field.kind === 'datetime' ? 'datetime-local'
          : field.kind === 'number' ? 'number'
          : 'text';

        return (
          <label key={field.name} htmlFor={id} className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              {field.label}
              {'optional' in field && field.optional && (
                <span className="font-normal text-slate-400"> (optional)</span>
              )}
            </span>
            <input
              id={id}
              type={type}
              inputMode={field.kind === 'number' ? 'decimal' : undefined}
              placeholder={'placeholder' in field ? field.placeholder : undefined}
              value={values[field.name] ?? ''}
              onChange={(e) => set(field.name, e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>
        );
      })}

      {derived && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: `${config.accent}12`, color: config.accent }}
        >
          <span>Calculated</span>
          <span className="text-lg">{derived}</span>
        </div>
      )}

      <PhotoPicker onChange={setPhoto} accent={config.accent} />

      {status && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            status.kind === 'ok' ? 'bg-emerald-50 text-emerald-800'
            : status.kind === 'queued' ? 'bg-amber-50 text-amber-800'
            : 'bg-red-50 text-red-700'
          }`}
        >
          {status.text}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !complete}
        style={{ backgroundColor: config.accent }}
        className="w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Saving…' : `Log ${config.label.toLowerCase()}`}
      </button>
    </div>
  );
}

function initial(config: MetricConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of config.fields) {
    if (f.kind === 'date') out[f.name] = new Date().toISOString().slice(0, 10);
    if (f.kind === 'datetime') out[f.name] = new Date().toISOString().slice(0, 16);
    if (f.kind === 'stepper') out[f.name] = String(f.min ?? 1);
  }
  return out;
}
