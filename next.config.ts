import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Cloudinary — all product images, PCN certs, avatars
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Unsplash / Pexels — placeholder images during development
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      // GitHub avatars (if needed)
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options',           value: 'DENY'                           },
      { key: 'X-Content-Type-Options',    value: 'nosniff'                        },
      { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin'},
      { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;