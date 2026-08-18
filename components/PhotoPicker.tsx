'use client';

import { useRef, useState } from 'react';

/**
 * Downscales before upload — carried over from the Apps Script version, which
 * got this right. A 12 MP phone photo is ~4 MB; this lands around 150 KB, which
 * matters a great deal on warehouse signal.
 */
async function downscale(file: File, max = 1100, quality = 0.6): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  let { width, height } = img;
  if (width > max || height > max) {
    const scale = max / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export function PhotoPicker({
  label = 'Photo evidence',
  onChange,
  accent,
}: {
  label?: string;
  onChange: (dataUrl: string | null) => void;
  accent?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await downscale(file);
      setPreview(url);
      onChange(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected evidence preview" className="max-h-56 w-full object-cover" />
          <button
            type="button"
            onClick={() => { setPreview(null); onChange(null); if (input.current) input.current.value = ''; }}
            className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          style={accent ? { borderColor: `${accent}55`, color: accent } : undefined}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 text-slate-600"
        >
          <span aria-hidden className="text-2xl">📷</span>
          <span className="text-sm font-medium">{busy ? 'Processing…' : 'Take or choose a photo'}</span>
        </button>
      )}
    </div>
  );
}
