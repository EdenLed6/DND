/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
