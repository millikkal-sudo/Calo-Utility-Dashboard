import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { METRICS } from '@/lib/metrics';

/**
 * Single insert endpoint for all six metrics. The offline queue posts here.
 *
 * Writes go through the anon-key client bound to the caller's session, so RLS
 * decides what is allowed — not this handler. That's deliberate: it means a
 * mistake here can't become a data leak.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ metric: string }> },
) {
  const { metric } = await params;
  const config = METRICS[metric];
  if (!config) {
    return NextResponse.json({ error: 'Unknown metric' }, { status: 404 });
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: staffRow } = await supabase
    .from('staff').select('id').eq('auth_uid', user.id).single();
  if (!staffRow) {
    return NextResponse.json(
      { error: 'Your account is not linked to a staff record. Ask a manager to add you.' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request body' }, { status: 400 });

  // Only accept fields this metric declares. Anything else is dropped rather
  // than passed to Postgres.
  const row: Record<string, unknown> = {};
  for (const field of config.fields) {
    if (body[field.name] !== undefined && body[field.name] !== '') {
      row[field.name] = body[field.name];
    }
  }
  row.logged_by = staffRow.id;

  // Owner columns that default to the submitter when the form didn't ask.
  if (config.table === 'water_bottle_receipts' && !row.received_by) row.received_by = staffRow.id;
  if (config.table === 'purchases' && !row.purchased_by) row.purchased_by = staffRow.id;
  if (config.table === 'fuel_receipts' && !row.received_by) row.received_by = staffRow.id;

  if (body.photo) {
    const path = await uploadEvidence(supabase, metric, body.photo);
    if (path) {
      const column =
        config.table === 'fuel_receipts' ? 'note_path'
        : config.table === 'purchases' ? 'receipt_path'
        : config.table === 'water_bottle_receipts' ? 'invoice_path'
        : 'photo_path';
      row[column] = path;
    }
  }

  const { data, error } = await supabase
    .from(config.table).insert(row).select('id').single();

  if (error) {
    // P0001 is our meter-continuity guard; surface its message, which names the
    // expected reading, rather than a generic failure.
    const status = error.code === 'P0001' || error.code === '23514' ? 422 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

async function uploadEvidence(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  metric: string,
  dataUrl: string,
): Promise<string | null> {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, b64] = match;
  const now = new Date();
  const path = `${metric}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from('utility-evidence')
    .upload(path, Buffer.from(b64, 'base64'), { contentType: mime, upsert: false });

  // A failed photo must not lose the entry — the numbers matter more than the
  // picture. Log and continue.
  if (error) {
    console.error('evidence upload failed', error.message);
    return null;
  }
  return path;
}
