/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  webpack: (config) => {
    // konva's package resolves to a Node build (konva/lib/index-node.js)
    // that requires the native `canvas` package. The wireframe editor
    // only ever runs client-side (loaded via next/dynamic, ssr: false),
    // so that Node build is never actually reached at runtime — but
    // webpack still tries to resolve it statically. Alias it away.
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
