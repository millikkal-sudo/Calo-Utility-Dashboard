import { supabaseServer } from '@/lib/supabase/server';

/**
 * Paginated server-side. The Apps Script version merged all six datasets in the
 * browser and re-sorted the whole history on every render.
 *
 * Values are rendered as JSX text, so React escapes them. The old version built
 * these rows with innerHTML and interpolated vendor names unescaped — a vendor
 * called `<img onerror=...>` executed in the manager's session.
 */
export async function ActivityTable({
  start, end, staffId, limit = 50,
}: {
  start: string;
  end: string;
  staffId?: string;
  limit?: number;
}) {
  const supabase = await supabaseServer();

  let query = supabase
    .from('activity_feed')
    .select('kind, ref, occurred_on, created_at, detail, logged_by, photo_path, legacy_photo_url')
    .gte('occurred_on', start)
    .lte('occurred_on', end)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (staffId) query = query.eq('logged_by', staffId);

  const [{ data: rows }, { data: staff }] = await Promise.all([
    query,
    supabase.from('staff').select('id, full_name'),
  ]);

  const nameOf = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

  // Signed URLs for the private bucket, batched into one round trip.
  const paths = (rows ?? []).map((r) => r.photo_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage
      .from('utility-evidence')
      .createSignedUrls(paths, 300);
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
    }
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-700">
        Recent activity
      </h2>

      {!rows?.length ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          No entries for this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Activity between {start} and {end}
            </caption>
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-5 py-3 font-medium">Type</th>
                <th scope="col" className="px-5 py-3 font-medium">Detail</th>
                <th scope="col" className="px-5 py-3 font-medium">By</th>
                <th scope="col" className="px-5 py-3 font-medium">When</th>
                <th scope="col" className="px-5 py-3 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const url = r.photo_path ? signed.get(r.photo_path) : r.legacy_photo_url;
                return (
                  <tr key={`${r.kind}-${r.ref}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-700">{r.kind}</td>
                    <td className="px-5 py-3 text-slate-700">{r.detail}</td>
                    <td className="px-5 py-3 text-slate-600">{nameOf.get(r.logged_by) ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(r.created_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener" className="text-brand-600 underline">
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows?.length === limit && (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing the {limit} most recent entries.
        </p>
      )}
    </section>
  );
}
