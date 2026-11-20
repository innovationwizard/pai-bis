/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/mercadeo": [
      "./docs-mercadeo-oct-09/performance-dashboard-puerta-abierta-pbix_2026-08-06/Performance-Report-Puerta-Abierta.xlsx",
    ],
  },
};

module.exports = nextConfig;
