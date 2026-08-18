type Row = {
  id: string;
  label: string | null;
  cycle_hours: number;
  switched_at: string | null;
  diesel_level: number | null;
  level_unit: string | null;
  logged_by_name: string | null;
  due_at: string | null;
  overdue: boolean | null;
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

export function GeneratorStatus({ rows }: { rows: Row[] }) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-700">
        Generator status
      </h2>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No generators configured yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => {
            const overdue = !!g.overdue || !g.switched_at;
            const hoursLate = g.due_at
              ? Math.floor((Date.now() - new Date(g.due_at).getTime()) / 3.6e6)
              : 0;

            return (
              <div
                key={g.id}
                className={`rounded-xl border p-4 ${
                  overdue ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{g.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      overdue ? 'bg-red-700 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {overdue ? 'Overdue' : 'On track'}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  Diesel level:{' '}
                  <span className="font-semibold text-slate-800">
                    {g.diesel_level ?? '—'} {g.level_unit ?? ''}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Last switched {when(g.switched_at)} · by {g.logged_by_name ?? '—'}
                </p>
                <p className={`mt-1 text-xs ${overdue ? 'font-medium text-red-700' : 'text-slate-500'}`}>
                  {!g.switched_at
                    ? 'Never logged.'
                    : overdue
                      ? `Switch was due ${when(g.due_at)} — missed by ${hoursLate}h.`
                      : `Next switch due by ${when(g.due_at)}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
