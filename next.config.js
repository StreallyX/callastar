const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // ⚠️ SUPPRIMER output + outputFileTracingRoot
  // output: process.env.NEXT_OUTPUT_MODE,

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
};

module.exports = withNextIntl(nextConfig);
