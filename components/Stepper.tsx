'use client';

export function Stepper({
  value, onChange, min = 1, max = 999, label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n || min));

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - 1))}
        className="h-12 w-12 shrink-0 rounded-xl border border-slate-300 text-2xl font-semibold text-slate-600"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-lg font-semibold"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + 1))}
        className="h-12 w-12 shrink-0 rounded-xl border border-slate-300 text-2xl font-semibold text-slate-600"
      >
        +
      </button>
    </div>
  );
}
