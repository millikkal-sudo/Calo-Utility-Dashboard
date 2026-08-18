import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Issues short-lived signed URLs for evidence photos. The bucket is private, so
 * this is the only way to view one — replacing the Apps Script version's
 * permanent, sometimes-public Drive links.
 */
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { paths } = await request.json().catch(() => ({ paths: [] }));
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ urls: {} });
  }

  const urls: Record<string, string> = {};
  await Promise.all(
    paths.slice(0, 100).map(async (p: string) => {
      const { data } = await supabase.storage
        .from('utility-evidence')
        .createSignedUrl(p, 300); // five minutes is plenty to render a thumbnail
      if (data?.signedUrl) urls[p] = data.signedUrl;
    }),
  );

  return NextResponse.json({ urls });
}
