import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @okidoc/shared is a workspace package compiled to CommonJS (packages/shared/dist).
  transpilePackages: ['@okidoc/shared'],
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
