/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pixelhub/types", "@pixelhub/ai", "@pixelhub/db"],
  experimental: {
    serverComponentsExternalPackages: ["sharp", "@prisma/client"],
  },
};

export default nextConfig;
