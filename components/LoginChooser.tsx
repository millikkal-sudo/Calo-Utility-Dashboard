'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Staff = { id: string; full_name: string };

export function LoginChooser({ staff, next }: { staff: Staff[]; next: string }) {
  const [mode, setMode] = useState<'choose' | 'staff'>('choose');

  if (mode === 'staff') return <PinForm staff={staff} onBack={() => setMode('choose')} />;

  return (
    <div className="space-y-3">
      <GoogleButton next={next} />
      <button
        type="button"
        onClick={() => setMode('staff')}
        className="flex w-full items-center gap-4 rounded-2xl border-2 border-amber-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-500"
      >
        <span aria-hidden className="text-3xl">👷</span>
        <span>
          <span className="block font-bold">Staff</span>
          <span className="block text-sm text-slate-500">Quick daily entry with your PIN</span>
        </span>
      </button>
    </div>
  );
}

function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { hd: 'calo.app' }, // pre-filters the Google account picker
      },
    });
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className="flex w-full items-center gap-4 rounded-2xl border-2 border-brand-100 bg-white p-5 text-left shadow-sm transition hover:border-brand-500 disabled:opacity-50"
    >
      <span aria-hidden className="text-3xl">📊</span>
      <span>
        <span className="block font-bold">{busy ? 'Redirecting…' : 'Manager'}</span>
        <span className="block text-sm text-slate-500">Sign in with your Calo account</span>
      </span>
    </button>
  );
}

function PinForm({ staff, onBack }: { staff: Staff[]; onBack: () => void }) {
  const router = useRouter();
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, pin }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Sign-in failed.');
        return;
      }

      const supabase = supabaseBrowser();
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: body.email,
        token_hash: body.token,
        type: 'magiclink',
      });
      if (otpError) {
        setError('Could not start a session. Ask a manager for help.');
        return;
      }
      router.push('/log');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">Your name</span>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3"
        >
          <option value="">Select name…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">4-digit PIN</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !staffId || pin.length !== 4}
        className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-3.5 font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Checking…' : 'Continue'}
      </button>

      <button type="button" onClick={onBack} className="mt-3 w-full text-sm text-slate-500">
        Back
      </button>
    </div>
  );
}
