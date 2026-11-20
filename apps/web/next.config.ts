import path from 'node:path';
import type { NextConfig } from 'next';

// The Docker image builds with NEXT_OUTPUT=standalone: a self-contained server.js plus only the node_modules it
// needs. Local `next start` keeps the normal output.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @okidoc/shared is a workspace package compiled to CommonJS (packages/shared/dist).
  transpilePackages: ['@okidoc/shared'],
  images: { unoptimized: true },
  poweredByHeader: false,
  ...(standalone && {
    output: 'standalone',
    // Monorepo: trace files from the repo root so the workspace package is included.
    outputFileTracingRoot: path.join(__dirname, '../..'),
  }),
};

export default nextConfig;
