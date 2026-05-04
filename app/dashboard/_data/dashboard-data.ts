export type Severity = "critical" | "high" | "medium" | "low";
export type SortKey = Severity | "project";
export type FixStatus = "fixed" | "available" | "none";

export type Vulnerability = {
  component: string;
  cve: string;
  severity: Severity;
  cvss: number;
  pkg: string;
  packageVersion?: string;
  fixStatus: FixStatus;
  discoveryDate: string;
};

export type TrendPoint = {
  week: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type ProjectRecord = {
  project: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  trend: number[];
  trendDetail: TrendPoint[];
  vulnerabilities: Vulnerability[];
};

export const REPORTING_WEEK = "2026-W17";

export const trendWeeks = ["W10", "W11", "W12", "W13", "W14", "W15", "W16", "W17"];

export const severityTone: Record<Severity, string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  high: "border-amber-300 bg-amber-50 text-amber-900",
  medium: "border-sky-300 bg-sky-50 text-sky-900",
  low: "border-slate-300 bg-slate-50 text-slate-900",
};

export const severityStroke: Record<Severity, string> = {
  critical: "#dc2626",
  high: "#d97706",
  medium: "#0369a1",
  low: "#475569",
};

export const projectData: ProjectRecord[] = [
  {
    project: "CTDC",
    critical: 7,
    high: 24,
    medium: 61,
    low: 12,
    trend: [56, 54, 52, 50, 47, 45, 42, 40],
    trendDetail: [
      { week: "W10", critical: 10, high: 27, medium: 66, low: 15 },
      { week: "W11", critical: 9, high: 26, medium: 65, low: 14 },
      { week: "W12", critical: 9, high: 25, medium: 64, low: 14 },
      { week: "W13", critical: 8, high: 25, medium: 63, low: 13 },
      { week: "W14", critical: 8, high: 25, medium: 63, low: 13 },
      { week: "W15", critical: 8, high: 24, medium: 62, low: 13 },
      { week: "W16", critical: 7, high: 24, medium: 61, low: 12 },
      { week: "W17", critical: 7, high: 24, medium: 61, low: 12 },
    ],
    vulnerabilities: [
      { component: "ctdc-backend", cve: "CVE-2024-3094", severity: "critical", cvss: 9.8, pkg: "xz-utils", fixStatus: "available", discoveryDate: "2026-04-11" },
      { component: "ctdc-backend", cve: "CVE-2025-1230", severity: "critical", cvss: 9.2, pkg: "openssl", fixStatus: "available", discoveryDate: "2026-03-22" },
      { component: "ctdc-web", cve: "CVE-2025-0890", severity: "high", cvss: 7.7, pkg: "curl", fixStatus: "fixed", discoveryDate: "2026-02-19" },
      { component: "ctdc-files", cve: "CVE-2024-9012", severity: "high", cvss: 7.2, pkg: "zlib", fixStatus: "none", discoveryDate: "2026-03-04" },
      { component: "ctdc-worker", cve: "CVE-2026-0219", severity: "medium", cvss: 6.3, pkg: "libxml2", fixStatus: "available", discoveryDate: "2026-01-29" },
    ],
  },
  {
    project: "ICDC",
    critical: 3,
    high: 12,
    medium: 45,
    low: 8,
    trend: [22, 25, 30, 34, 28, 21, 20, 18],
    trendDetail: [
      { week: "W10", critical: 6, high: 16, medium: 53, low: 12 },
      { week: "W11", critical: 6, high: 17, medium: 54, low: 12 },
      { week: "W12", critical: 5, high: 18, medium: 53, low: 11 },
      { week: "W13", critical: 5, high: 18, medium: 51, low: 10 },
      { week: "W14", critical: 4, high: 15, medium: 49, low: 10 },
      { week: "W15", critical: 4, high: 14, medium: 47, low: 9 },
      { week: "W16", critical: 3, high: 13, medium: 46, low: 9 },
      { week: "W17", critical: 3, high: 12, medium: 45, low: 8 },
    ],
    vulnerabilities: [
      { component: "crdc-icdc-backend", cve: "CVE-2024-3094", severity: "critical", cvss: 9.8, pkg: "xz-utils", packageVersion: "5.6.1", fixStatus: "available", discoveryDate: "2026-04-14" },
      { component: "crdc-icdc-backend", cve: "CVE-2024-1234", severity: "critical", cvss: 9.1, pkg: "openssl", packageVersion: "1.1.1", fixStatus: "available", discoveryDate: "2026-04-09" },
      { component: "crdc-icdc-frontend", cve: "CVE-2025-0015", severity: "critical", cvss: 8.9, pkg: "libexpat", packageVersion: "2.5.0", fixStatus: "none", discoveryDate: "2026-04-02" },
      { component: "crdc-icdc-backend", cve: "CVE-2024-5678", severity: "high", cvss: 7.8, pkg: "curl", packageVersion: "8.4.0", fixStatus: "fixed", discoveryDate: "2026-03-29" },
      { component: "crdc-icdc-files", cve: "CVE-2024-9012", severity: "high", cvss: 7.2, pkg: "zlib", packageVersion: "1.3.1", fixStatus: "available", discoveryDate: "2026-03-18" },
      { component: "crdc-icdc-interoperation", cve: "CVE-2024-3311", severity: "high", cvss: 6.9, pkg: "glibc", packageVersion: "2.37", fixStatus: "none", discoveryDate: "2026-03-02" },
      { component: "crdc-icdc-frontend", cve: "CVE-2025-4183", severity: "medium", cvss: 6.2, pkg: "axios", packageVersion: "1.7.0", fixStatus: "available", discoveryDate: "2026-02-17" },
      { component: "crdc-icdc-backend", cve: "CVE-2025-4182", severity: "medium", cvss: 5.9, pkg: "lodash", packageVersion: "4.17.20", fixStatus: "available", discoveryDate: "2026-02-15" },
      { component: "crdc-icdc-files", cve: "CVE-2024-7710", severity: "low", cvss: 3.1, pkg: "tar", packageVersion: "1.34", fixStatus: "fixed", discoveryDate: "2026-01-25" },
      { component: "crdc-icdc-backend", cve: "CVE-2024-7788", severity: "low", cvss: 2.9, pkg: "libarchive", packageVersion: "3.7.2", fixStatus: "none", discoveryDate: "2026-01-19" },
    ],
  },
  {
    project: "PopSci",
    critical: 1,
    high: 8,
    medium: 19,
    low: 4,
    trend: [10, 11, 9, 8, 8, 7, 6, 5],
    trendDetail: [
      { week: "W10", critical: 2, high: 12, medium: 24, low: 8 },
      { week: "W11", critical: 2, high: 12, medium: 23, low: 8 },
      { week: "W12", critical: 2, high: 11, medium: 22, low: 7 },
      { week: "W13", critical: 1, high: 10, medium: 21, low: 6 },
      { week: "W14", critical: 1, high: 9, medium: 21, low: 6 },
      { week: "W15", critical: 1, high: 9, medium: 20, low: 5 },
      { week: "W16", critical: 1, high: 8, medium: 20, low: 5 },
      { week: "W17", critical: 1, high: 8, medium: 19, low: 4 },
    ],
    vulnerabilities: [
      { component: "popsci-frontend", cve: "CVE-2025-2101", severity: "critical", cvss: 9.0, pkg: "expat", fixStatus: "available", discoveryDate: "2026-04-16" },
      { component: "popsci-api", cve: "CVE-2024-1199", severity: "high", cvss: 7.4, pkg: "nghttp2", fixStatus: "none", discoveryDate: "2026-03-12" },
      { component: "popsci-files", cve: "CVE-2024-1102", severity: "medium", cvss: 6.1, pkg: "zip", fixStatus: "fixed", discoveryDate: "2026-02-28" },
    ],
  },
  {
    project: "GEN",
    critical: 0,
    high: 4,
    medium: 11,
    low: 2,
    trend: [8, 8, 8, 7, 7, 6, 6, 5],
    trendDetail: [
      { week: "W10", critical: 0, high: 5, medium: 15, low: 4 },
      { week: "W11", critical: 0, high: 5, medium: 15, low: 4 },
      { week: "W12", critical: 0, high: 5, medium: 14, low: 3 },
      { week: "W13", critical: 0, high: 5, medium: 13, low: 3 },
      { week: "W14", critical: 0, high: 4, medium: 13, low: 3 },
      { week: "W15", critical: 0, high: 4, medium: 12, low: 2 },
      { week: "W16", critical: 0, high: 4, medium: 11, low: 2 },
      { week: "W17", critical: 0, high: 4, medium: 11, low: 2 },
    ],
    vulnerabilities: [
      { component: "gen-worker", cve: "CVE-2024-8802", severity: "high", cvss: 7.0, pkg: "redis", fixStatus: "available", discoveryDate: "2026-03-20" },
      { component: "gen-api", cve: "CVE-2024-8803", severity: "medium", cvss: 5.7, pkg: "protobuf", fixStatus: "fixed", discoveryDate: "2026-02-20" },
    ],
  },
];

export function getProjectBySlug(slug: string): ProjectRecord | undefined {
  const normalized = decodeURIComponent(slug).toLowerCase();
  return projectData.find((project) => project.project.toLowerCase() === normalized);
}
