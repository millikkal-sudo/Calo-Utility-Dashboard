import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange_failed`);

  const { data: { user } } = await supabase.auth.getUser();

  // Link this Google account to an existing staff row by name-independent means:
  // a manager pre-creates the row, we match on email local part or full name.
  if (user?.email) {
    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from('staff').select('id').eq('auth_uid', user.id).maybeSingle();

    if (!existing) {
      const guess = user.user_metadata?.full_name ?? user.email.split('@')[0];
      await admin
        .from('staff')
        .update({ auth_uid: user.id })
        .is('auth_uid', null)
        .ilike('full_name', guess);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
