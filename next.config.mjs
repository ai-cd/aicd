import dotenv from "dotenv";

dotenv.config({ path: ".secret/.env" });

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "4mb" }
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders
    }
  ]
};

export default nextConfig;
