/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@restaurant-qr/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
