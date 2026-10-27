import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/generate-report": ["./lib/template.docx"],
  },
};

export default nextConfig;
