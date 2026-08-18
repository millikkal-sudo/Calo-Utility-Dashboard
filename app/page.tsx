import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Role is decided by the database, not by a URL parameter.
 * The Apps Script version put it in the query string (?role=manager), so anyone
 * could promote themselves by editing the address bar.
 */
export default async function Home() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_uid', user.id).single();

  redirect(staff?.role === 'manager' ? '/dashboard' : '/log');
}
