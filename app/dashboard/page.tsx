import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { fmt, money, monthBounds, monthLabel, today } from '@/lib/format';
import { MetricCard } from '@/components/MetricCard';
import { DashboardCharts } from '@/components/DashboardCharts';
import { GeneratorStatus } from '@/components/GeneratorStatus';
import { ActivityTable } from '@/components/ActivityTable';

type Summary = {
  pickups: number; gallons: number; gas: number; diesel: number;
  spend: number; bottles: number;
  tanks: { t5: number; t10: number };
  pay: { cash: number; card: number };
  fuel_series: { d: string; gas: number; diesel: number }[];
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; staff?: string }>;
}) {
  const { month: monthParam, staff: staffParam } = await searchParams;
  const month = monthParam ?? today().slice(0, 7);
  const { start, end } = monthBounds(month);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Role comes from the database. A crafted URL cannot grant manager access
  // the way ?role=manager did in the Apps Script version.
  const { data: viewer } = await supabase
    .from('staff').select('full_name, role').eq('auth_uid', user!.id).single();
  if (viewer?.role !== 'manager') redirect('/log');

  const [{ data: summary }, { data: staffList }, { data: generators }] = await Promise.all([
    supabase.rpc('dashboard_summary', {
      p_start: start,
      p_end: end,
      p_staff: staffParam ?? null,
    }),
    supabase.from('staff').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('generator_status').select('*'),
  ]);

  const s = (summary ?? {}) as Summary;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Overview</h1>
          <p className="text-sm text-slate-500">
            Signed in as {viewer.full_name} · {monthLabel(month)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker month={month} staff={staffParam} />
          <StaffPicker staff={staffList ?? []} selected={staffParam} month={month} />
          <Link href="/log" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600">
            Log entry
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <MetricCard icon="🗑" label="Garbage pickups" value={fmt(s.pickups)} unit="collections" accent="#047857" />
        <MetricCard icon="💧" label="Waste water" value={fmt(s.gallons)} unit="gallons" accent="#0369a1" />
        <MetricCard icon="⛽" label="Gas received" value={fmt(s.gas)} unit="units" accent="#b45309" />
        <MetricCard icon="⛽" label="Diesel received" value={fmt(s.diesel)} unit="units" accent="#9a3412" />
        <MetricCard icon="🧾" label="Maintenance spend" value={money(s.spend)} unit="" accent="#7c3aed" />
        <MetricCard icon="🥤" label="Water bottles" value={fmt(s.bottles)} unit="received" accent="#0891b2" />
      </div>

      <DashboardCharts
        tanks={s.tanks ?? { t5: 0, t10: 0 }}
        pay={s.pay ?? { cash: 0, card: 0 }}
        fuelSeries={s.fuel_series ?? []}
      />

      <GeneratorStatus rows={generators ?? []} />
      <ActivityTable start={start} end={end} staffId={staffParam} />
    </main>
  );
}

function MonthPicker({ month, staff }: { month: string; staff?: string }) {
  return (
    <form className="flex items-center gap-2">
      {staff && <input type="hidden" name="staff" value={staff} />}
      <label htmlFor="month" className="sr-only">Month</label>
      <input
        id="month"
        type="month"
        name="month"
        defaultValue={month}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">
        Go
      </button>
    </form>
  );
}

function StaffPicker({
  staff, selected, month,
}: {
  staff: { id: string; full_name: string }[];
  selected?: string;
  month: string;
}) {
  return (
    <form className="flex items-center gap-2">
      <input type="hidden" name="month" value={month} />
      <label htmlFor="staff" className="sr-only">Filter by staff member</label>
      <select
        id="staff"
        name="staff"
        defaultValue={selected ?? ''}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All staff</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>{s.full_name}</option>
        ))}
      </select>
      <button type="submit" className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
