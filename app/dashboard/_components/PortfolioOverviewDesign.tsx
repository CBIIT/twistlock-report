"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioData, type SortKey } from "@/app/dashboard/_hooks/useDashboardApi";

type SortDirection = "asc" | "desc";

function formatProjectName(project: string) {
  return project.toUpperCase();
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <span className="text-xs text-slate-400">No data</span>;
  }

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
      <polyline fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export default function PortfolioOverviewDesign() {
  const [sortBy, setSortBy] = useState<SortKey>("critical");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hasIssuesOnly, setHasIssuesOnly] = useState(true);
  const { data, isLoading, error, reload } = usePortfolioData({ sortBy, hasIssuesOnly });

  const projects = useMemo(() => {
    const rows = [...(data?.projects ?? [])];

    rows.sort((a, b) => {
      const directionMultiplier = sortDirection === "asc" ? 1 : -1;
      if (sortBy === "project") {
        return a.project.localeCompare(b.project) * directionMultiplier;
      }
      return (a[sortBy] - b[sortBy]) * directionMultiplier;
    });

    return rows;
  }, [data?.projects, sortBy, sortDirection]);

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextKey);
    setSortDirection(nextKey === "project" ? "asc" : "desc");
  }

  function getSortLabel(key: SortKey) {
    if (sortBy !== key) {
      return "Sort";
    }
    return sortDirection === "asc" ? "Sorted asc" : "Sorted desc";
  }

  function renderSortIcon(key: SortKey) {
    if (sortBy !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />;
    }

    if (sortDirection === "asc") {
      return <ArrowUp className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />;
    }

    return <ArrowDown className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#e0f2fe_0%,#f8fafc_28%,#ffffff_65%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.65)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Twistlock Production site vulnerability dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Production Site Vulnerability Risk Overview</h1>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900">
              Week: {data?.week ?? "-"}
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_56px_-40px_rgba(15,23,42,0.45)]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-slate-950">Portfolio Dashboard</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setHasIssuesOnly((v) => !v)}
                className={
                  hasIssuesOnly
                    ? "inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-900 transition"
                    : "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 transition"
                }
              >
                {hasIssuesOnly ? "Has issues" : "All projects"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("project")}
                        aria-label={`Sort by project. ${getSortLabel("project")}`}
                      >
                        <span>Project</span>
                        {renderSortIcon("project")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("critical")}
                        aria-label={`Sort by critical. ${getSortLabel("critical")}`}
                      >
                        <span>Critical</span>
                        {renderSortIcon("critical")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("high")}
                        aria-label={`Sort by high. ${getSortLabel("high")}`}
                      >
                        <span>High</span>
                        {renderSortIcon("high")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("medium")}
                        aria-label={`Sort by medium. ${getSortLabel("medium")}`}
                      >
                        <span>Medium</span>
                        {renderSortIcon("medium")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("low")}
                        aria-label={`Sort by low. ${getSortLabel("low")}`}
                      >
                        <span>Low</span>
                        {renderSortIcon("low")}
                      </button>
                    </th>
                    <th className="px-4 py-3">Trend (8w)</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading dashboard data...</td>
                    </tr>
                  ) : null}
                  {!isLoading && error ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-red-600">{error}</p>
                          <Button type="button" variant="outline" size="sm" onClick={reload}>Retry</Button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {!isLoading && !error && projects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No projects found for the selected filters.</td>
                    </tr>
                  ) : null}
                  {projects.map((row) => (
                    <tr key={row.project} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatProjectName(row.project)}</td>
                      <td className="px-4 py-3 text-red-700">{row.critical}</td>
                      <td className="px-4 py-3 text-amber-700">{row.high}</td>
                      <td className="px-4 py-3 text-sky-700">{row.medium}</td>
                      <td className="px-4 py-3 text-slate-700">{row.low}</td>
                      <td className="px-4 py-3"><Sparkline values={row.trend} /></td>
                      <td className="px-4 py-3">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/drilldown/${encodeURIComponent(row.project.toLowerCase())}`}>View Details</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
