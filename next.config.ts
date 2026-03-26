import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['socket.io-client'],
  productionBrowserSourceMaps: false,
  turbopack: {},
};

export default nextConfig;
