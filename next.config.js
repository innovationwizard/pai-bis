/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/ventas/vista": ["./docs-ventas/**/*"],
  },
};

module.exports = nextConfig;
