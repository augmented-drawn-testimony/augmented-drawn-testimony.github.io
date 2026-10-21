/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export",
  output: "standalone",
  images: { unoptimized: true },
};

module.exports = nextConfig;
