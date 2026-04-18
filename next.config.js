/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    browserDebugInfoInTerminal: true,
  },
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  devIndicators: false,
  allowedDevOrigins: [
    "*.macaly.dev",
    "*.macaly.app",
    "*.macaly-app.com",
    "*.macaly-user-data.dev",
  ],
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        condition: {
          all: [{ not: "foreign" }, "development"],
        },
        loaders: [
          {
            loader: "macaly-tagger",
            options: {
              disableSourceMaps: true,
              ignorePackages: [
                // Skip components imported from these packages (requires macaly-tagger v1.2.0+)
                "@react-three/fiber",
                "@react-three/drei",
              ],
            },
          },
        ],
        as: "*",
      },
    },
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.module.rules.unshift({
        test: /\.(jsx|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "macaly-tagger",
            options: {
              ignorePackages: [
                // Skip components imported from these packages (requires macaly-tagger v1.2.0+)
                "@react-three/fiber",
                "@react-three/drei",
              ],
            },
          },
        ],
        enforce: "pre",
      });
    }

    return config;
  },
};

module.exports = nextConfig;
