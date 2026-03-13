import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate-report": ["./lib/template.docx"],
  },
};

export default nextConfig;
