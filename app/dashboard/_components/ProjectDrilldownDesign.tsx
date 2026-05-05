"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  severityStroke,
  severityTone,
  type Severity,
} from "@/app/dashboard/_data/dashboard-data";
import {
  useDrilldownData,
  type FixStatus,
  type TrendPoint,
} from "@/app/dashboard/_hooks/useDashboardApi";

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

function TrendChart({
  trendDetail,
  trendWeeks,
  activeSeries,
}: {
  trendDetail: TrendPoint[];
  trendWeeks: string[];
  activeSeries: Severity[];
}) {
  const chartHeight = 220;
  const chartWidth = 700;
  const allValues = trendDetail.flatMap((d) => [d.critical, d.high, d.medium, d.low, 0]);
  const max = Math.max(...allValues) + 4;
  const denominator = Math.max(trendDetail.length - 1, 1);

  function toPoints(key: Severity) {
    return trendDetail
      .map((point, index) => {
        const x = (index / denominator) * (chartWidth - 20) + 10;
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
              <line key={tick} x1="0" y1={y} x2={chartWidth} y2={y} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth="1" />
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
            const x = (idx / Math.max(trendWeeks.length - 1, 1)) * (chartWidth - 20) + 10;
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

export default function ProjectDrilldownDesign({ projectSlug }: { projectSlug: string }) {
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>(["critical", "high"]);
  const [activeTrendSeries, setActiveTrendSeries] = useState<Severity[]>(["critical", "high", "medium", "low"]);
  const [componentFilter, setComponentFilter] = useState("all");
  const [fixFilter, setFixFilter] = useState<"all" | FixStatus>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 50;
  const { data, isLoading, error, reload } = useDrilldownData({
    projectSlug,
    selectedSeverities,
    componentFilter,
    fixFilter,
    query,
    page,
    pageSize,
  });

  const components = data?.filters.components ?? [];
  const visibleRows = data?.rows ?? [];
  const totalRows = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = data?.pagination.page ?? page;
  const displayPage = Math.min(safePage, totalPages);
  const selectedProjectName = data?.project ?? decodeURIComponent(projectSlug).toUpperCase();
  const reportingWeek = data?.week ?? "-";
  const totals = data?.totals ?? { critical: 0, high: 0, medium: 0, low: 0 };

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
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Project drilldown</h1>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900">
              Week: {reportingWeek}
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_56px_-40px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <span>/</span>
              <span className="font-semibold text-slate-900">{selectedProjectName}</span>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900">
              Week: {reportingWeek}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
              <article key={sev} className={cn("rounded-2xl border p-4", cardTone(sev))}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">{sev}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{totals[sev]}</p>
              </article>
            ))}
          </div>

          <div className="mt-6">
            <TrendChart
              trendDetail={data?.trendDetail ?? []}
              trendWeeks={data?.trendWeeks ?? []}
              activeSeries={activeTrendSeries}
            />
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
                <table className="w-full min-w-[980px] text-left text-sm">
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
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-7 text-center text-slate-500">Loading vulnerabilities...</td>
                      </tr>
                    ) : null}
                    {!isLoading && error ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-7 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <p className="text-red-600">{error}</p>
                            <Button type="button" variant="outline" size="sm" onClick={reload}>Retry</Button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {visibleRows.map((row, index) => (
                      <tr key={`${row.cve}-${row.component}-${row.pkg}-${row.packageVersion ?? "na"}-${index}`} className="border-t border-slate-100 align-top">
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
                    {!isLoading && !error && visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-7 text-center text-slate-500">No vulnerabilities match the selected filters.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing <span className="font-semibold text-slate-900">{visibleRows.length}</span> of {totalRows}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={displayPage === 1 || isLoading}>
                  <ArrowLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 font-medium text-slate-900">{displayPage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={displayPage === totalPages || isLoading}>
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
