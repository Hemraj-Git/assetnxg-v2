import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The desktop app lives under /admin. A config redirect runs before
  // rendering, so "/" needs no page (a page that only redirects fails the
  // instant-navigation check). Temporary (307): the home page may change.
  // On console.assetnxg.app / console.localhost the home is the console.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "console\\..*" }],
        destination: "/console",
        permanent: false,
      },
      { source: "/", destination: "/admin", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
