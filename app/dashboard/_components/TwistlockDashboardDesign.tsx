"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "low";
type SortKey = Severity | "project";
type FixStatus = "fixed" | "available" | "none";

type Vulnerability = {
  component: string;
  cve: string;
  severity: Severity;
  cvss: number;
  pkg: string;
  packageVersion?: string;
  fixStatus: FixStatus;
  discoveryDate: string;
};

type TrendPoint = {
  week: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

type ProjectRecord = {
  project: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  trend: number[];
  trendDetail: TrendPoint[];
  vulnerabilities: Vulnerability[];
};

const REPORTING_WEEK = "2026-W17";

const trendWeeks = ["W10", "W11", "W12", "W13", "W14", "W15", "W16", "W17"];

const projectData: ProjectRecord[] = [
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

const severityTone: Record<Severity, string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  high: "border-amber-300 bg-amber-50 text-amber-900",
  medium: "border-sky-300 bg-sky-50 text-sky-900",
  low: "border-slate-300 bg-slate-50 text-slate-900",
};

const severityStroke: Record<Severity, string> = {
  critical: "#dc2626",
  high: "#d97706",
  medium: "#0369a1",
  low: "#475569",
};

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const width = 120;
  const height = 28;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = max === min ? height / 2 : ((max - v) / (max - min)) * (height - 4) + 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-28" role="img" aria-label="8 week trend sparkline">
      <polyline
        fill="none"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function SeverityChip({ value }: { value: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
        severityTone[value]
      )}
    >
      {value}
    </span>
  );
}

function TrendChart({ trendDetail, activeSeries }: { trendDetail: TrendPoint[]; activeSeries: Severity[] }) {
  const chartHeight = 220;
  const chartWidth = 700;
  const allValues = trendDetail.flatMap((d) => [d.critical, d.high, d.medium, d.low]);
  const max = Math.max(...allValues) + 4;

  function toPoints(key: Severity) {
    return trendDetail
      .map((point, index) => {
        const x = (index / (trendDetail.length - 1)) * (chartWidth - 20) + 10;
        const y = chartHeight - (point[key] / max) * (chartHeight - 20) - 10;
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-26px_rgba(15,23,42,0.28)]">
      <h3 className="text-lg font-semibold text-slate-950">Vulnerability Trend</h3>
      <p className="mt-1 text-sm text-slate-600">8-week severity movement by selected series</p>
      <div className="mt-5 overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 min-w-[680px] w-full" aria-label="Vulnerability trend chart">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = chartHeight - tick * (chartHeight - 20) - 10;
            return (
              <line
                key={tick}
                x1="0"
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="#cbd5e1"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {(["critical", "high", "medium", "low"] as Severity[]).map((series) =>
            activeSeries.includes(series) ? (
              <polyline
                key={series}
                points={toPoints(series)}
                fill="none"
                stroke={severityStroke[series]}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null
          )}

          {trendWeeks.map((wk, idx) => {
            const x = (idx / (trendWeeks.length - 1)) * (chartWidth - 20) + 10;
            return (
              <text key={wk} x={x} y={chartHeight - 1} textAnchor="middle" fontSize="11" fill="#475569">
                {wk}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function cardTone(severity: Severity) {
  switch (severity) {
    case "critical":
      return "border-red-300 bg-red-50";
    case "high":
      return "border-amber-300 bg-amber-50";
    case "medium":
      return "border-sky-300 bg-sky-50";
    case "low":
      return "border-slate-300 bg-slate-100";
    default:
      return "border-slate-300 bg-slate-50";
  }
}

export default function TwistlockDashboardDesign() {
  const [sortBy, setSortBy] = useState<SortKey>("critical");
  const [hasIssuesOnly, setHasIssuesOnly] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord>(projectData[1]);

  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>(["critical", "high"]);
  const [activeTrendSeries, setActiveTrendSeries] = useState<Severity[]>(["critical", "high", "medium", "low"]);
  const [componentFilter, setComponentFilter] = useState("all");
  const [fixFilter, setFixFilter] = useState<"all" | FixStatus>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const projects = useMemo(() => {
    const filtered = hasIssuesOnly
      ? projectData.filter((p) => p.critical + p.high + p.medium + p.low > 0)
      : projectData;

    return [...filtered].sort((a, b) => {
      if (sortBy === "project") {
        return a.project.localeCompare(b.project);
      }
      return b[sortBy] - a[sortBy];
    });
  }, [hasIssuesOnly, sortBy]);

  const components = useMemo(() => {
    return Array.from(new Set(selectedProject.vulnerabilities.map((v) => v.component)));
  }, [selectedProject]);

  const filteredVulns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return selectedProject.vulnerabilities.filter((v) => {
      const severityMatch = selectedSeverities.includes(v.severity);
      const componentMatch = componentFilter === "all" || v.component === componentFilter;
      const fixMatch = fixFilter === "all" || v.fixStatus === fixFilter;
      const searchMatch =
        !q ||
        v.component.toLowerCase().includes(q) ||
        v.cve.toLowerCase().includes(q) ||
        v.pkg.toLowerCase().includes(q);

      return severityMatch && componentMatch && fixMatch && searchMatch;
    });
  }, [componentFilter, fixFilter, query, selectedProject, selectedSeverities]);

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredVulns.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const visibleRows = filteredVulns.slice(pageStart, pageStart + pageSize);

  function toggleSeverity(value: Severity, list: Severity[], setter: (v: Severity[]) => void) {
    if (list.includes(value)) {
      const next = list.filter((x) => x !== value);
      if (next.length > 0) {
        setter(next);
      }
      return;
    }
    setter([...list, value]);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#e0f2fe_0%,#f8fafc_28%,#ffffff_65%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.65)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Twistlock vulnerability dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Portfolio risk overview and drilldown</h1>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900">
              Week: {REPORTING_WEEK}
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_56px_-40px_rgba(15,23,42,0.45)]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-slate-950">Portfolio Dashboard</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
                Sort by
                <select
                  className="bg-transparent text-slate-900 outline-none"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  aria-label="Sort projects"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="project">Project</option>
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              </label>

              <button
                type="button"
                onClick={() => setHasIssuesOnly((v) => !v)}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 font-medium transition",
                  hasIssuesOnly
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                )}
              >
                {hasIssuesOnly ? "Has issues" : "All projects"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Critical</th>
                    <th className="px-4 py-3">High</th>
                    <th className="px-4 py-3">Medium</th>
                    <th className="px-4 py-3">Low</th>
                    <th className="px-4 py-3">Trend (8w)</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((row) => (
                    <tr key={row.project} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.project}</td>
                      <td className="px-4 py-3 text-red-700">{row.critical}</td>
                      <td className="px-4 py-3 text-amber-700">{row.high}</td>
                      <td className="px-4 py-3 text-sky-700">{row.medium}</td>
                      <td className="px-4 py-3 text-slate-700">{row.low}</td>
                      <td className="px-4 py-3"><Sparkline values={row.trend} /></td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProject(row);
                            setPage(1);
                          }}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_56px_-40px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <button type="button" className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </button>
              <span>/</span>
              <span className="font-semibold text-slate-900">{selectedProject.project}</span>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900">
              Week: {REPORTING_WEEK}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
              <article key={sev} className={cn("rounded-2xl border p-4", cardTone(sev))}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">{sev}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{selectedProject[sev]}</p>
              </article>
            ))}
          </div>

          <div className="mt-6">
            <TrendChart trendDetail={selectedProject.trendDetail} activeSeries={activeTrendSeries} />

            <div className="mt-4 flex flex-wrap gap-2">
              {(["critical", "high", "medium", "low"] as Severity[]).map((severity) => {
                const active = activeTrendSeries.includes(severity);
                return (
                  <button
                    key={severity}
                    type="button"
                    onClick={() => toggleSeverity(severity, activeTrendSeries, setActiveTrendSeries)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition",
                      active ? severityTone[severity] : "border-slate-300 bg-white text-slate-600"
                    )}
                  >
                    {active ? "On" : "Off"} {severity}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/60 p-4 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Vulnerabilities</h3>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  {(["critical", "high", "medium", "low"] as Severity[]).map((severity) => {
                    const active = selectedSeverities.includes(severity);
                    return (
                      <button
                        key={severity}
                        type="button"
                        onClick={() => {
                          toggleSeverity(severity, selectedSeverities, setSelectedSeverities);
                          setPage(1);
                        }}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
                          active ? severityTone[severity] : "border-slate-300 bg-white text-slate-600"
                        )}
                      >
                        {active ? "Selected" : "Hidden"} {severity}
                      </button>
                    );
                  })}
                </div>

                <label className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
                  Component
                  <select
                    value={componentFilter}
                    onChange={(e) => {
                      setComponentFilter(e.target.value);
                      setPage(1);
                    }}
                    className="ml-2 bg-transparent font-medium text-slate-900 outline-none"
                    aria-label="Filter by component"
                  >
                    <option value="all">All</option>
                    {components.map((component) => (
                      <option key={component} value={component}>{component}</option>
                    ))}
                  </select>
                </label>

                <label className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
                  Fix
                  <select
                    value={fixFilter}
                    onChange={(e) => {
                      setFixFilter(e.target.value as "all" | FixStatus);
                      setPage(1);
                    }}
                    className="ml-2 bg-transparent font-medium text-slate-900 outline-none"
                    aria-label="Filter by fix status"
                  >
                    <option value="all">All</option>
                    <option value="fixed">Fixed</option>
                    <option value="available">Fix available</option>
                    <option value="none">No fix</option>
                  </select>
                </label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search CVE, package, component"
                    className="h-9 w-[260px] rounded-full pl-9"
                    aria-label="Search vulnerabilities"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Component</th>
                      <th className="px-4 py-3">CVE</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">CVSS</th>
                      <th className="px-4 py-3">Package</th>
                      <th className="px-4 py-3">Fix status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={`${row.cve}-${row.component}`} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.component}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.cve}</td>
                        <td className="px-4 py-3"><SeverityChip value={row.severity} /></td>
                        <td className="px-4 py-3 text-slate-700">{row.cvss.toFixed(1)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.pkg}
                          {row.packageVersion ? <span className="text-slate-500"> ({row.packageVersion})</span> : null}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-700">{row.fixStatus === "available" ? "fix available" : row.fixStatus}</td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-7 text-center text-slate-500">
                          No vulnerabilities match the selected filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing <span className="font-semibold text-slate-900">{visibleRows.length}</span> of {filteredVulns.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ArrowLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 font-medium text-slate-900">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
