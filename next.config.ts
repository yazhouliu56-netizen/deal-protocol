import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: false,
});

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "eixqnwaxcnwtxiizmdfs.supabase.co" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/oto",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default withSerwist({
  ...nextConfig,
});
