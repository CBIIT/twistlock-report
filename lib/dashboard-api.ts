import { query } from "@/lib/db";

export type Severity = "critical" | "high" | "medium" | "low";
export type SortKey = Severity | "project";
export type FixStatus = "fixed" | "available" | "none";

const DEFAULT_SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export class DashboardApiError extends Error {
	status: number;

	constructor(message: string, status = 500) {
		super(message);
		this.status = status;
	}
}

type PortfolioCountRow = {
	project: string;
	critical: string | number | null;
	high: string | number | null;
	medium: string | number | null;
	low: string | number | null;
};

type TrendRow = {
	project: string;
	week: string;
	total_vulns: string | number | null;
};

type ProjectNameRow = {
	project: string;
};

type DrilldownTotalsRow = {
	critical: string | number | null;
	high: string | number | null;
	medium: string | number | null;
	low: string | number | null;
};

type DrilldownTrendRow = {
	week: string;
	critical: string | number | null;
	high: string | number | null;
	medium: string | number | null;
	low: string | number | null;
};

type DrilldownVulnerabilityRow = {
	component: string;
	image_tag: string | null;
	cve_id: string | null;
	severity: string | null;
	cvss: string | number | null;
	package_name: string | null;
	package_version: string | null;
	fix_status: FixStatus;
};

type CountRow = {
	total: string | number;
};

function toNumber(value: string | number | null | undefined): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function normalizeWeek(week?: string): string | undefined {
	const value = week?.trim();
	if (!value) return undefined;
	if (!/^\d{4}-W\d{2}$/.test(value)) {
		throw new DashboardApiError("Invalid week format. Expected YYYY-WNN.", 400);
	}
	return value;
}

function normalizeSearchTerm(value?: string): string | null {
	const text = value?.trim();
	return text ? text : null;
}

function decodeProjectSlug(slug: string): string {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
}

async function resolveWeek(week?: string): Promise<string> {
	const requestedWeek = normalizeWeek(week);
	if (requestedWeek) return requestedWeek;

	const rows = await query<{ week: string }>(`
		SELECT week
		FROM scans
		GROUP BY week
		ORDER BY week DESC
		LIMIT 1
	`);

	const latest = rows[0]?.week;
	if (!latest) {
		throw new DashboardApiError("No scan data available.", 404);
	}

	return latest;
}

async function getLatestWeeks(limit: number, project?: string): Promise<string[]> {
	if (!project) {
		const rows = await query<{ week: string }>(`
			SELECT week
			FROM scans
			GROUP BY week
			ORDER BY week DESC
			LIMIT $1
		`, [limit]);
		return rows.map((row) => row.week).reverse();
	}

	const rows = await query<{ week: string }>(`
		SELECT s.week
		FROM scans s
		JOIN image_tag_mapping itm ON itm.id = s.component_id
		JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
		WHERE LOWER(pim.project) = LOWER($1)
		GROUP BY s.week
		ORDER BY s.week DESC
		LIMIT $2
	`, [project, limit]);

	return rows.map((row) => row.week).reverse();
}

export async function getPortfolioPayload(options: {
	week?: string;
	sortBy?: SortKey;
	hasIssuesOnly?: boolean;
}): Promise<{
	week: string;
	trendWeeks: string[];
	projects: Array<{
		project: string;
		critical: number;
		high: number;
		medium: number;
		low: number;
		trend: number[];
	}>;
}> {
	const week = await resolveWeek(options.week);
	const sortBy = options.sortBy ?? "critical";
	const hasIssuesOnly = options.hasIssuesOnly ?? true;
	const trendWeeks = await getLatestWeeks(8);

	const portfolioRows = await query<PortfolioCountRow>(`
		WITH latest_scans AS (
			SELECT DISTINCT ON (s.component_id)
				s.id,
				s.component_id
			FROM scans s
			WHERE s.week = $1
			ORDER BY s.component_id, s.scanned_at DESC
		),
		unique_vulnerabilities AS (
			SELECT DISTINCT ON (pim.project, COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name), COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN'))
				pim.project,
				COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name) AS component,
				COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN') AS cve_id,
				LOWER(v.severity) AS severity
			FROM latest_scans ls
			JOIN image_tag_mapping itm ON itm.id = ls.component_id
			JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
			JOIN vulnerabilities v ON v.scan_id = ls.id
			WHERE LOWER(v.severity) IN ('critical', 'high', 'medium', 'low')
			ORDER BY
				pim.project,
				COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name),
				COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN'),
				CASE LOWER(v.severity)
					WHEN 'critical' THEN 1
					WHEN 'high' THEN 2
					WHEN 'medium' THEN 3
					WHEN 'low' THEN 4
					ELSE 5
				END
		)
		SELECT
			project,
			COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
			COUNT(*) FILTER (WHERE severity = 'high') AS high,
			COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
			COUNT(*) FILTER (WHERE severity = 'low') AS low
		FROM unique_vulnerabilities
		GROUP BY project
	`, [week]);

	const trendRows: TrendRow[] = trendWeeks.length
		? await query<TrendRow>(`
			WITH latest_week_component_scans AS (
				SELECT DISTINCT ON (s.week, s.component_id)
					s.id,
					s.week,
					s.component_id
				FROM scans s
				WHERE s.week = ANY($1::text[])
				ORDER BY s.week, s.component_id, s.scanned_at DESC
			),
			unique_vulnerabilities AS (
				SELECT DISTINCT ON (pim.project, lws.week, COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name), COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN'))
					pim.project,
					lws.week,
					COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name) AS component,
					COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN') AS cve_id
				FROM latest_week_component_scans lws
				JOIN image_tag_mapping itm ON itm.id = lws.component_id
				JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
				JOIN vulnerabilities v ON v.scan_id = lws.id
				ORDER BY
					pim.project,
					lws.week,
					COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name),
					COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN')
			)
			SELECT
				project,
				week,
				COUNT(*) AS total_vulns
			FROM unique_vulnerabilities
			GROUP BY project, week
		`, [trendWeeks])
		: [];

	const trendMap = new Map<string, Map<string, number>>();
	for (const row of trendRows) {
		const byWeek = trendMap.get(row.project) ?? new Map<string, number>();
		byWeek.set(row.week, toNumber(row.total_vulns));
		trendMap.set(row.project, byWeek);
	}

	const projects = portfolioRows
		.map((row) => {
			const critical = toNumber(row.critical);
			const high = toNumber(row.high);
			const medium = toNumber(row.medium);
			const low = toNumber(row.low);
			const weeklyTrend = trendWeeks.map((trendWeek) => trendMap.get(row.project)?.get(trendWeek) ?? 0);

			return {
				project: row.project,
				critical,
				high,
				medium,
				low,
				trend: weeklyTrend,
			};
		})
		.filter((row) => (hasIssuesOnly ? row.critical + row.high + row.medium + row.low > 0 : true))
		.sort((a, b) => {
			if (sortBy === "project") {
				return a.project.localeCompare(b.project);
			}
			return b[sortBy] - a[sortBy];
		});

	return {
		week,
		trendWeeks,
		projects,
	};
}

async function resolveProjectName(projectSlug: string): Promise<string> {
	const decoded = decodeProjectSlug(projectSlug).trim();
	if (!decoded) {
		throw new DashboardApiError("Project is required.", 400);
	}

	const projectRows = await query<ProjectNameRow>(`
		SELECT pim.project
		FROM project_image_mapping pim
		WHERE LOWER(pim.project) = LOWER($1)
		GROUP BY pim.project
		LIMIT 1
	`, [decoded]);

	const project = projectRows[0]?.project;
	if (!project) {
		throw new DashboardApiError(`Project '${decoded}' not found.`, 404);
	}

	return project;
}

export async function getDrilldownPayload(options: {
	projectSlug: string;
	week?: string;
	severities?: Severity[];
	component?: string;
	fixStatus?: FixStatus;
	query?: string;
	page?: number;
	pageSize?: number;
}): Promise<{
	week: string;
	project: string;
	totals: { critical: number; high: number; medium: number; low: number };
	trendWeeks: string[];
	trendDetail: Array<{ week: string; critical: number; high: number; medium: number; low: number }>;
	filters: { components: string[]; fixStatuses: FixStatus[] };
	rows: Array<{
		component: string;
		imageTag: string;
		cve: string;
		severity: Severity;
		cvss: number;
		pkg: string;
		packageVersion?: string;
		fixStatus: FixStatus;
	}>;
	pagination: { page: number; pageSize: number; total: number };
}> {
	const project = await resolveProjectName(options.projectSlug);
	const week = await resolveWeek(options.week);
	const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(options.pageSize, 100) : 50;
	const page = options.page && options.page > 0 ? options.page : 1;
	const offset = (page - 1) * pageSize;

	const selectedSeverities =
		options.severities && options.severities.length > 0 ? options.severities : DEFAULT_SEVERITIES;
	const componentFilter = options.component && options.component !== "all" ? options.component : null;
	const fixStatusFilter = options.fixStatus && options.fixStatus !== "none" ? options.fixStatus : options.fixStatus ?? null;
	const q = normalizeSearchTerm(options.query);

	const totalsRows = await query<DrilldownTotalsRow>(`
		WITH latest_scans AS (
			SELECT DISTINCT ON (s.component_id)
				s.id,
				s.component_id
			FROM scans s
			JOIN image_tag_mapping itm ON itm.id = s.component_id
			JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
			WHERE s.week = $1
				AND LOWER(pim.project) = LOWER($2)
			ORDER BY s.component_id, s.scanned_at DESC
		),
		unique_vulnerabilities AS (
			SELECT DISTINCT ON (COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name), COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN'))
				COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name) AS component,
				COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN') AS cve_id,
				LOWER(v.severity) AS severity
			FROM latest_scans ls
			JOIN image_tag_mapping itm ON itm.id = ls.component_id
			JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
			JOIN vulnerabilities v ON v.scan_id = ls.id
			WHERE LOWER(v.severity) IN ('critical', 'high', 'medium', 'low')
			ORDER BY
				COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name),
				COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN'),
				CASE LOWER(v.severity)
					WHEN 'critical' THEN 1
					WHEN 'high' THEN 2
					WHEN 'medium' THEN 3
					WHEN 'low' THEN 4
					ELSE 5
				END
		)
		SELECT
			COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
			COUNT(*) FILTER (WHERE severity = 'high') AS high,
			COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
			COUNT(*) FILTER (WHERE severity = 'low') AS low
		FROM unique_vulnerabilities
	`, [week, project]);

	const totals = {
		critical: toNumber(totalsRows[0]?.critical),
		high: toNumber(totalsRows[0]?.high),
		medium: toNumber(totalsRows[0]?.medium),
		low: toNumber(totalsRows[0]?.low),
	};

	const trendWeeks = await getLatestWeeks(8, project);
	const trendRows: DrilldownTrendRow[] = trendWeeks.length
		? await query<DrilldownTrendRow>(`
			WITH latest_scans AS (
				SELECT DISTINCT ON (s.week, s.component_id)
					s.id,
					s.week,
					s.component_id
				FROM scans s
				JOIN image_tag_mapping itm ON itm.id = s.component_id
				JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
				WHERE s.week = ANY($1::text[])
					AND LOWER(pim.project) = LOWER($2)
				ORDER BY s.week, s.component_id, s.scanned_at DESC
			),
			unique_vulnerabilities AS (
				SELECT DISTINCT ON (ls.week, COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name), COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN'))
					ls.week,
					COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name) AS component,
					COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN') AS cve_id,
					LOWER(v.severity) AS severity
				FROM latest_scans ls
				JOIN image_tag_mapping itm ON itm.id = ls.component_id
				JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
				JOIN vulnerabilities v ON v.scan_id = ls.id
				WHERE LOWER(v.severity) IN ('critical', 'high', 'medium', 'low')
				ORDER BY
					ls.week,
					COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name),
					COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN'),
					CASE LOWER(v.severity)
						WHEN 'critical' THEN 1
						WHEN 'high' THEN 2
						WHEN 'medium' THEN 3
						WHEN 'low' THEN 4
						ELSE 5
					END
			)
			SELECT
				week,
				COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
				COUNT(*) FILTER (WHERE severity = 'high') AS high,
				COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
				COUNT(*) FILTER (WHERE severity = 'low') AS low
			FROM unique_vulnerabilities
			GROUP BY week
			ORDER BY week
		`, [trendWeeks, project])
		: [];

	const trendByWeek = new Map<string, DrilldownTrendRow>();
	for (const row of trendRows) {
		trendByWeek.set(row.week, row);
	}

	const trendDetail = trendWeeks.map((trendWeek) => {
		const row = trendByWeek.get(trendWeek);
		return {
			week: trendWeek,
			critical: toNumber(row?.critical),
			high: toNumber(row?.high),
			medium: toNumber(row?.medium),
			low: toNumber(row?.low),
		};
	});

	const vulnerabilitySql = `
		WITH latest_scans AS (
			SELECT DISTINCT ON (s.component_id)
				s.id,
				s.component_id
			FROM scans s
			JOIN image_tag_mapping itm ON itm.id = s.component_id
			JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
			WHERE s.week = $1
				AND LOWER(pim.project) = LOWER($2)
			ORDER BY s.component_id, s.scanned_at DESC
		),
		base AS (
			SELECT
				COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name) AS component,
				COALESCE(NULLIF(BTRIM(itm.current_tag), ''), 'UNKNOWN') AS image_tag,
				COALESCE(NULLIF(BTRIM(v.cve_id), ''), 'UNKNOWN') AS cve_id,
				LOWER(v.severity) AS severity,
				v.cvss,
				v.package_name,
				v.package_version,
				CASE
					WHEN v.fix_status IS NULL OR BTRIM(v.fix_status) = '' THEN 'none'
					WHEN LOWER(v.fix_status) LIKE 'fixed%' THEN 'fixed'
					WHEN LOWER(v.fix_status) IN ('available', 'needed', 'deferred') THEN 'available'
					ELSE 'none'
				END AS fix_status
			FROM latest_scans ls
			JOIN image_tag_mapping itm ON itm.id = ls.component_id
			JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
			JOIN vulnerabilities v ON v.scan_id = ls.id
		),
		filtered AS (
			SELECT *
			FROM base
			WHERE severity = ANY($3::text[])
				AND ($4::text IS NULL OR component = $4)
				AND ($5::text IS NULL OR fix_status = $5)
				AND (
					$6::text IS NULL
					OR LOWER(COALESCE(cve_id, '')) LIKE '%' || LOWER($6) || '%'
					OR LOWER(COALESCE(package_name, '')) LIKE '%' || LOWER($6) || '%'
					OR LOWER(component) LIKE '%' || LOWER($6) || '%'
					OR LOWER(COALESCE(image_tag, '')) LIKE '%' || LOWER($6) || '%'
				)
		),
		deduped AS (
			SELECT DISTINCT ON (component, image_tag, cve_id)
				component,
				image_tag,
				cve_id,
				severity,
				cvss,
				package_name,
				package_version,
				fix_status
			FROM filtered
			ORDER BY
				component,
				image_tag,
				cve_id,
				CASE severity
					WHEN 'critical' THEN 1
					WHEN 'high' THEN 2
					WHEN 'medium' THEN 3
					WHEN 'low' THEN 4
					ELSE 5
				END,
				cvss DESC NULLS LAST,
				package_name NULLS LAST,
				package_version NULLS LAST
		)
	`;

	const vulnerabilityRows = await query<DrilldownVulnerabilityRow>(
		`${vulnerabilitySql}
		SELECT component, image_tag, cve_id, severity, cvss, package_name, package_version, fix_status
		FROM deduped
		ORDER BY
			CASE severity
				WHEN 'critical' THEN 1
				WHEN 'high' THEN 2
				WHEN 'medium' THEN 3
				WHEN 'low' THEN 4
				ELSE 5
			END,
			cvss DESC NULLS LAST,
			cve_id
		LIMIT $7 OFFSET $8
	`, [week, project, selectedSeverities, componentFilter, fixStatusFilter, q, pageSize, offset]
	);

	const countRows = await query<CountRow>(
		`${vulnerabilitySql}
		SELECT COUNT(*) AS total FROM deduped
	`, [week, project, selectedSeverities, componentFilter, fixStatusFilter, q]
	);

	const componentsRows = await query<{ component: string }>(`
		WITH latest_scans AS (
			SELECT DISTINCT ON (s.component_id)
				s.id,
				s.component_id
			FROM scans s
			JOIN image_tag_mapping itm ON itm.id = s.component_id
			JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
			WHERE s.week = $1
				AND LOWER(pim.project) = LOWER($2)
			ORDER BY s.component_id, s.scanned_at DESC
		)
		SELECT COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name) AS component
		FROM latest_scans ls
		JOIN image_tag_mapping itm ON itm.id = ls.component_id
		JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
		ORDER BY COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name)
	`, [week, project]);

	const rows = vulnerabilityRows
		.map((row) => {
			const severity = (row.severity ?? "").toLowerCase();
			if (!DEFAULT_SEVERITIES.includes(severity as Severity)) {
				return null;
			}
			return {
				component: row.component,
				imageTag: row.image_tag ?? "UNKNOWN",
				cve: row.cve_id ?? "UNKNOWN",
				severity: severity as Severity,
				cvss: toNumber(row.cvss),
				pkg: row.package_name ?? "unknown",
				packageVersion: row.package_version ?? undefined,
				fixStatus: row.fix_status,
			};
		})
		.filter((row): row is NonNullable<typeof row> => row !== null);

	return {
		week,
		project,
		totals,
		trendWeeks,
		trendDetail,
		filters: {
			components: componentsRows.map((row) => row.component),
			fixStatuses: ["fixed", "available", "none"],
		},
		rows,
		pagination: {
			page,
			pageSize,
			total: toNumber(countRows[0]?.total),
		},
	};
}
