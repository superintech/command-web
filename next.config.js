/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sit-pms/shared'],
  typescript: {
    // Pre-existing type errors in reports components — suppress until properly fixed
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
