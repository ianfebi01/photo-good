import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output : 'standalone',
  images : {
    remotePatterns : [
      {
        protocol : 'https',
        hostname : 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source  : '/api/booth/:path*',
        headers : [
          { key : 'Access-Control-Allow-Origin', value : 'http://localhost:3000, http://localhost:3001' },
          { key : 'Access-Control-Allow-Methods', value : 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key : 'Access-Control-Allow-Headers', value : 'Authorization, Content-Type, x-booth-key' },
          { key : 'Content-Security-Policy', value : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' http://localhost:3000 http://localhost:3001 https://api.midtrans.com https://api.sandbox.midtrans.com; font-src 'self'; object-src 'none'; frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com" },
        ],
      },
      {
        source  : '/api/captures/:path*',
        headers : [
          { key : 'Access-Control-Allow-Origin', value : 'http://localhost:3000, http://localhost:3001' },
          { key : 'Content-Security-Policy', value : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' http://localhost:3000 http://localhost:3001 https://api.midtrans.com https://api.sandbox.midtrans.com; font-src 'self'; object-src 'none'; frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com" },
        ],
      },
    ]
  },
};

export default nextConfig;
