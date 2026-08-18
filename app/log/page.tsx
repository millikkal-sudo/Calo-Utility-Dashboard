import Link from 'next/link';
import { METRIC_LIST } from '@/lib/metrics';
import { supabaseServer } from '@/lib/supabase/server';

export default async function LogIndex() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: staff } = await supabase
    .from('staff').select('full_name, role').eq('auth_uid', user!.id).single();

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold">Daily entry</h1>
          <p className="text-sm text-slate-500">{staff?.full_name}</p>
        </div>
        {staff?.role === 'manager' && (
          <Link href="/dashboard" className="text-sm font-semibold text-brand-600">
            Dashboard →
          </Link>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        {METRIC_LIST.map((m) => (
          <Link
            key={m.slug}
            href={`/log/${m.slug}`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-6 shadow-sm"
          >
            <span aria-hidden className="text-3xl">{m.icon}</span>
            <span className="text-sm font-semibold" style={{ color: m.accent }}>{m.label}</span>
          </Link>
        ))}
      </div>

      <form action="/auth/signout" method="post" className="mt-8">
        <button type="submit" className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-600">
          Sign out
        </button>
      </form>
    </main>
  );
}
