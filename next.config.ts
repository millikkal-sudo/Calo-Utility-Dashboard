import type { NextConfig } from 'next';

const config: NextConfig = {
  // Evidence photos are served through short-lived signed URLs from Supabase
  // Storage, so the bucket host must be allowed for next/image.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/sign/**' },
      // Historic receipts still live in Google Drive (see legacy_photo_url).
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
  },
};

export default config;
