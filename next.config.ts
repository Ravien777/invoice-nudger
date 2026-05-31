import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  modularizeImports: {
    "date-fns": {
      transform: "date-fns/{{member}}",
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/icon-:size(192|512).png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
