"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type SortKey = "project" | "critical" | "high" | "medium" | "low";
export type Severity = "critical" | "high" | "medium" | "low";
export type FixStatus = "fixed" | "available" | "none";

export type PortfolioProjectRow = {
  project: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  trend: number[];
};

export type PortfolioPayload = {
  week: string;
  projects: PortfolioProjectRow[];
};

export type TrendPoint = {
  week: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type DrilldownRow = {
  component: string;
  cve: string;
  severity: Severity;
  cvss: number;
  pkg: string;
  packageVersion?: string;
  fixStatus: FixStatus;
};

export type DrilldownPayload = {
  week: string;
  project: string;
  totals: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  trendWeeks: string[];
  trendDetail: TrendPoint[];
  filters: {
    components: string[];
    fixStatuses: FixStatus[];
  };
  rows: DrilldownRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

type AsyncState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function useApiData<T>(buildUrl: () => string): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const reload = useCallback(() => {
    setReloadCounter((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(buildUrl(), {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Failed to load data.");
        }

        const payload = (await response.json()) as T;
        if (active) {
          setData(payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load data.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [buildUrl, reloadCounter]);

  return { data, isLoading, error, reload };
}

export function usePortfolioData(input: { sortBy: SortKey; hasIssuesOnly: boolean }): AsyncState<PortfolioPayload> {
  const query = useMemo(() => {
    const params = new URLSearchParams({
      sortBy: input.sortBy,
      hasIssuesOnly: input.hasIssuesOnly ? "true" : "false",
    });
    return params.toString();
  }, [input.hasIssuesOnly, input.sortBy]);

  return useApiData<PortfolioPayload>(useCallback(() => `/api/dashboard/portfolio?${query}`, [query]));
}

export function useDrilldownData(input: {
  projectSlug: string;
  selectedSeverities: Severity[];
  componentFilter: string;
  query: string;
  page: number;
  pageSize: number;
}): AsyncState<DrilldownPayload> {
  const debouncedQuery = useDebouncedValue(input.query, 350);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      severities: input.selectedSeverities.join(","),
      page: String(input.page),
      pageSize: String(input.pageSize),
    });

    if (input.componentFilter !== "all") {
      params.set("component", input.componentFilter);
    }

    const searchText = debouncedQuery.trim();
    if (searchText) {
      params.set("q", searchText);
    }

    return params.toString();
  }, [
    input.componentFilter,
    input.page,
    input.pageSize,
    debouncedQuery,
    input.selectedSeverities,
  ]);

  const encodedProject = useMemo(() => encodeURIComponent(input.projectSlug), [input.projectSlug]);

  return useApiData<DrilldownPayload>(
    useCallback(() => `/api/dashboard/drilldown/${encodedProject}?${queryString}`, [encodedProject, queryString])
  );
}
