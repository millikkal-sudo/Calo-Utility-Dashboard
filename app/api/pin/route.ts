import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * PIN exchange for floor staff on the shared warehouse device.
 *
 * The whole point of doing this server-side: the Apps Script version validated
 * the manager password in the browser and stored the result in localStorage, so
 * anyone could grant themselves access. Here the PIN never round-trips to a
 * client check, and the response is a real Supabase session.
 *
 * Each staff member needs a shadow auth user (staff+<id>@calo.app) created by a
 * manager; pin_hash is set at the same time.
 */
export async function POST(request: Request) {
  const { staffId, pin } = await request.json().catch(() => ({}));

  if (typeof staffId !== 'string' || !/^\d{4}$/.test(String(pin ?? ''))) {
    return NextResponse.json({ error: 'Enter your 4-digit PIN.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: staff } = await admin
    .from('staff')
    .select('id, full_name, pin_hash, active, auth_uid')
    .eq('id', staffId)
    .single();

  const expected = staff?.pin_hash ?? '';
  const given = hash(String(pin), staffId);

  // Compare even when the staff row is missing, so a wrong ID and a wrong PIN
  // take the same time and reveal the same thing.
  const ok =
    !!staff?.active &&
    expected.length === given.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(given));

  if (!ok) {
    return NextResponse.json({ error: 'That PIN did not match.' }, { status: 401 });
  }

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: shadowEmail(staff!.id),
  });

  if (error || !link) {
    return NextResponse.json({ error: 'Could not start a session.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    name: staff!.full_name,
    // The client exchanges this for a session via verifyOtp.
    token: link.properties.hashed_token,
    email: shadowEmail(staff!.id),
  });
}

const shadowEmail = (staffId: string) => `staff+${staffId}@calo.app`;

function hash(pin: string, salt: string) {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}
