/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pi-ai / pi-agent-core are Node-targeted ESM; keep them out of the bundler
  // so they load natively in the Node route-handler runtime.
  serverExternalPackages: [
    "@earendil-works/pi-ai",
    "@earendil-works/pi-agent-core",
  ],
};

export default nextConfig;
