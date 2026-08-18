import { supabaseServer } from '@/lib/supabase/server';
import { LoginChooser } from '@/components/LoginChooser';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // The staff list is needed to pick a name before entering a PIN. It's the one
  // thing readable pre-auth, and it's only names.
  const supabase = await supabaseServer();
  const { data: staff } = await supabase
    .from('staff').select('id, full_name').eq('active', true).order('full_name');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight">Calo Utility</h1>
        <p className="mt-1 text-sm text-slate-500">Maintenance &amp; Stewarding</p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Sign-in failed. Please try again.
        </p>
      )}

      <LoginChooser staff={staff ?? []} next={next ?? '/'} />

      <p className="mt-8 text-center text-xs text-slate-400">
        Access is restricted to Calo accounts.
      </p>
    </main>
  );
}
