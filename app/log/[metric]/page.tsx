import { notFound } from 'next/navigation';
import Link from 'next/link';
import { METRICS } from '@/lib/metrics';
import { supabaseServer } from '@/lib/supabase/server';
import { LogForm } from '@/components/LogForm';

export default async function LogMetric({
  params,
}: {
  params: Promise<{ metric: string }>;
}) {
  const { metric } = await params;
  const config = METRICS[metric];
  if (!config) notFound();

  const supabase = await supabaseServer();
  const [{ data: staff }, { data: generators }] = await Promise.all([
    supabase.from('staff').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('generators').select('id, label').eq('active', true).order('id'),
  ]);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link href="/log" className="mb-4 inline-block text-sm text-slate-500">← All metrics</Link>
      <h1 className="mb-5 text-xl font-bold" style={{ color: config.accent }}>
        {config.icon} {config.label}
      </h1>
      <LogForm
        config={config}
        staff={staff ?? []}
        generators={generators ?? []}
      />
    </main>
  );
}
