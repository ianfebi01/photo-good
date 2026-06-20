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
          { key : 'Access-Control-Allow-Origin', value : '*' },
          { key : 'Access-Control-Allow-Methods', value : 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key : 'Access-Control-Allow-Headers', value : 'Authorization, Content-Type, x-booth-key' },
        ],
      },
      {
        source  : '/api/captures/:path*',
        headers : [
          { key : 'Access-Control-Allow-Origin', value : '*' },
        ],
      },
    ]
  },
};

export default nextConfig;
