import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "sw.js",
  swDest: "public/sw.js",
  disable: false,
});

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
};

export default withSerwist({
  ...nextConfig,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer && process.env.NODE_ENV === "production") {
      const JavaScriptObfuscator = require("webpack-obfuscator");
      config.plugins.push(
        new JavaScriptObfuscator({
          compact: true,
          selfDefending: true,
        }),
      );
    }
    return config;
  },
});
