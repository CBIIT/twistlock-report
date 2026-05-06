# Dashboard and Drilldown Implementation Details

## 1. Scope
This document defines how to implement the portfolio dashboard and project drilldown pages using the database schema in `db/schema.sql` and example data in `db/*.xlsx`.

Target UI pages:
- `/dashboard` (Portfolio risk overview)
- `/dashboard/drilldown/[project]` (Project drilldown)

## 2. Source Data Model

### 2.1 Tables from schema.sql

#### `public.components`
- `id` (PK)
- `project` (text)
- `image_name` (text)
- `current_tag` (text)
- `created_at` (timestamptz)

#### `public.scans`
- `id` (PK)
- `component_id` (FK to components.id)
- `week` (text, example: `2026-W19`)
- `scanned_at` (timestamptz)
- `vuln_count` (int)
- `scanned_tag` (text)

#### `public.vulnerabilities`
- `id` (PK)
- `scan_id` (FK to scans.id)
- `cve_id` (text)
- `severity` (text)
- `package_name` (text)
- `package_version` (text)
- `fix_status` (text)
- `cvss` (numeric)
- `description` (text)
- `image_id` (text)
- `image_name` (text)

### 2.2 Note about sample xlsx files
The example spreadsheets appear swapped by filename:
- `db/components.xlsx` contains scan-like columns (`component_id`, `week`, `vuln_count`, `scanned_tag`)
- `db/scans.xlsx` contains component-like columns (`project`, `image_name`, `current_tag`)

Implementation should trust table/column names from `schema.sql`, not spreadsheet filenames.

## 3. Canonical Join Path
Use this join chain for both pages:

`components c -> scans s -> vulnerabilities v`

SQL join:
```sql
FROM components c
JOIN scans s ON s.component_id = c.id
LEFT JOIN vulnerabilities v ON v.scan_id = s.id
```

## 4. Reporting Week Rules

### 4.1 Current week selection
Use one selected reporting week for all dashboard widgets.

Recommended source:
```sql
SELECT week
FROM scans
GROUP BY week
ORDER BY week DESC
LIMIT 1;
```

### 4.2 Latest scan per component within selected week
Use latest `scanned_at` to avoid duplicate component scans in same week.

```sql
WITH latest_component_scans AS (
  SELECT DISTINCT ON (s.component_id)
    s.id,
    s.component_id,
    s.week,
    s.scanned_at,
    s.scanned_tag,
    s.vuln_count
  FROM scans s
  WHERE s.week = $1
  ORDER BY s.component_id, s.scanned_at DESC
)
SELECT *
FROM latest_component_scans;
```

## 5. Portfolio Dashboard (`/dashboard`)

### 5.1 UI fields to return per project
- `project`
- `critical`
- `high`
- `medium`
- `low`
- `trend` (8-week total vulnerabilities)

### 5.2 Severity normalization
Normalize severity values in SQL:
- lower-case
- default unknown/null to `low` or exclude by policy

Recommended strict mapping:
- include only: `critical`, `high`, `medium`, `low`
- ignore null/unknown in severity counts

### 5.3 Project severity totals for selected week
```sql
WITH latest_scans AS (
  SELECT DISTINCT ON (s.component_id)
    s.id,
    s.component_id
  FROM scans s
  WHERE s.week = $1
  ORDER BY s.component_id, s.scanned_at DESC
)
SELECT
  c.project,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'critical') AS critical,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'high') AS high,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'medium') AS medium,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'low') AS low
FROM latest_scans ls
JOIN components c ON c.id = ls.component_id
LEFT JOIN vulnerabilities v ON v.scan_id = ls.id
GROUP BY c.project;
```

### 5.4 8-week trend per project
Return weekly totals for the last 8 weeks.

```sql
WITH week_rank AS (
  SELECT week
  FROM scans
  GROUP BY week
  ORDER BY week DESC
  LIMIT 8
),
latest_week_component_scans AS (
  SELECT DISTINCT ON (s.week, s.component_id)
    s.id,
    s.week,
    s.component_id
  FROM scans s
  JOIN week_rank wr ON wr.week = s.week
  ORDER BY s.week, s.component_id, s.scanned_at DESC
)
SELECT
  c.project,
  lws.week,
  COUNT(v.id) AS total_vulns
FROM latest_week_component_scans lws
JOIN components c ON c.id = lws.component_id
LEFT JOIN vulnerabilities v ON v.scan_id = lws.id
GROUP BY c.project, lws.week
ORDER BY c.project, lws.week;
```

Backend should pivot this result into:
```json
{
  "project": "ICDC",
  "trend": [/* oldest -> newest, 8 values */]
}
```

### 5.5 Sorting and filters
Support query params:
- `sortBy`: `project | critical | high | medium | low`
- `hasIssuesOnly`: boolean

`hasIssuesOnly=true` condition:
```text
(critical + high + medium + low) > 0
```

## 6. Project Drilldown (`/dashboard/drilldown/[project]`)

### 6.1 UI data blocks
1. Header totals cards:
- `critical`, `high`, `medium`, `low`

2. Trend chart:
- per week, per severity for last 8 weeks

3. Vulnerabilities table:
- `component` (components.image_name)
- `cve` (vulnerabilities.cve_id)
- `severity`
- `cvss`
- `package` (package_name + package_version)
- `fix_status`

### 6.2 Drilldown totals query (selected week)
```sql
WITH latest_scans AS (
  SELECT DISTINCT ON (s.component_id)
    s.id,
    s.component_id
  FROM scans s
  JOIN components c ON c.id = s.component_id
  WHERE s.week = $1
    AND LOWER(c.project) = LOWER($2)
  ORDER BY s.component_id, s.scanned_at DESC
)
SELECT
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'critical') AS critical,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'high') AS high,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'medium') AS medium,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'low') AS low
FROM latest_scans ls
LEFT JOIN vulnerabilities v ON v.scan_id = ls.id;
```

### 6.3 Drilldown trend query (8 weeks x 4 severities)
```sql
WITH week_rank AS (
  SELECT week
  FROM scans
  GROUP BY week
  ORDER BY week DESC
  LIMIT 8
),
latest_scans AS (
  SELECT DISTINCT ON (s.week, s.component_id)
    s.id,
    s.week,
    s.component_id
  FROM scans s
  JOIN components c ON c.id = s.component_id
  JOIN week_rank wr ON wr.week = s.week
  WHERE LOWER(c.project) = LOWER($1)
  ORDER BY s.week, s.component_id, s.scanned_at DESC
)
SELECT
  ls.week,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'critical') AS critical,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'high') AS high,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'medium') AS medium,
  COUNT(*) FILTER (WHERE LOWER(v.severity) = 'low') AS low
FROM latest_scans ls
LEFT JOIN vulnerabilities v ON v.scan_id = ls.id
GROUP BY ls.week
ORDER BY ls.week;
```

### 6.4 Vulnerability table query (selected week, latest scan/component)
Supported filters:
- `severities[]`
- `component` (`all` or exact image_name)
- `fixStatus` (`all | fixed | available | none`)
- `q` (search in CVE/package/component)
- pagination: `page`, `pageSize`

```sql
WITH latest_scans AS (
  SELECT DISTINCT ON (s.component_id)
    s.id,
    s.component_id
  FROM scans s
  JOIN components c ON c.id = s.component_id
  WHERE s.week = $1
    AND LOWER(c.project) = LOWER($2)
  ORDER BY s.component_id, s.scanned_at DESC
),
base AS (
  SELECT
    c.image_name AS component,
    v.cve_id,
    LOWER(v.severity) AS severity,
    v.cvss,
    v.package_name,
    v.package_version,
    LOWER(v.fix_status) AS fix_status
  FROM latest_scans ls
  JOIN components c ON c.id = ls.component_id
  JOIN vulnerabilities v ON v.scan_id = ls.id
  WHERE ($3::text[] IS NULL OR LOWER(v.severity) = ANY($3))
    AND ($4::text IS NULL OR c.image_name = $4)
    AND ($5::text IS NULL OR LOWER(v.fix_status) = $5)
    AND (
      $6::text IS NULL
      OR LOWER(v.cve_id) LIKE '%' || LOWER($6) || '%'
      OR LOWER(v.package_name) LIKE '%' || LOWER($6) || '%'
      OR LOWER(c.image_name) LIKE '%' || LOWER($6) || '%'
    )
)
SELECT *
FROM base
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
LIMIT $7 OFFSET $8;
```

Count query for pagination:
```sql
SELECT COUNT(*) FROM base;
```

## 7. API Shape

### 7.1 `GET /api/dashboard/portfolio?week=2026-W19&sortBy=critical&hasIssuesOnly=true`
Response:
```json
{
  "week": "2026-W19",
  "projects": [
    {
      "project": "ICDC",
      "critical": 3,
      "high": 12,
      "medium": 45,
      "low": 8,
      "trend": [87, 89, 87, 84, 78, 74, 71, 68]
    }
  ]
}
```

### 7.2 `GET /api/dashboard/drilldown/{project}?week=2026-W19&page=1&pageSize=5`
Response:
```json
{
  "week": "2026-W19",
  "project": "ICDC",
  "totals": { "critical": 3, "high": 12, "medium": 45, "low": 8 },
  "trendDetail": [
    { "week": "2026-W12", "critical": 5, "high": 18, "medium": 53, "low": 11 }
  ],
  "filters": {
    "components": ["crdc-icdc-backend", "crdc-icdc-files", "crdc-icdc-frontend"],
    "fixStatuses": ["fixed", "available", "none"]
  },
  "rows": [
    {
      "component": "crdc-icdc-backend",
      "cve": "CVE-2025-45582",
      "severity": "medium",
      "cvss": 4.1,
      "pkg": "tar",
      "packageVersion": "1.34+dfsg-1ubuntu0.1.22.04.2",
      "fixStatus": "needed"
    }
  ],
  "pagination": { "page": 1, "pageSize": 5, "total": 68 }
}
```

## 8. Data Quality and Normalization
- Severity should be normalized to lowercase.
- Fix status in sample data includes values beyond UI enum (`needed`, `deferred`, `fixed in ...`).
- Add fix-status mapping for UI:
  - `fixed` or `fixed in ...` -> `fixed`
  - `available`, `needed`, `deferred` -> `available`
  - null/empty/other -> `none`
- Keep raw value as `fix_status_raw` if audit/debug is needed.

## 9. Indexes
Add indexes to keep dashboard and drilldown fast:

```sql
CREATE INDEX IF NOT EXISTS idx_components_project ON components (project);
CREATE INDEX IF NOT EXISTS idx_components_project_image ON components (project, image_name);
CREATE INDEX IF NOT EXISTS idx_scans_component_week_scannedat ON scans (component_id, week, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_week ON scans (week);
CREATE INDEX IF NOT EXISTS idx_vuln_scan ON vulnerabilities (scan_id);
CREATE INDEX IF NOT EXISTS idx_vuln_severity ON vulnerabilities (severity);
CREATE INDEX IF NOT EXISTS idx_vuln_fix_status ON vulnerabilities (fix_status);
CREATE INDEX IF NOT EXISTS idx_vuln_cve ON vulnerabilities (cve_id);
```

Optional for search:
- Postgres trigram index on `cve_id`, `package_name`, `image_name`.

## 10. Implementation Steps
1. Build repository/service queries for:
   - latest week
   - portfolio summary
   - portfolio 8-week trend
   - drilldown totals
   - drilldown trend detail
   - drilldown vulnerabilities table + count
2. Add API routes:
   - `GET /api/dashboard/portfolio`
   - `GET /api/dashboard/drilldown/[project]`
3. Replace mock `projectData` in dashboard components with API fetch + typed DTO mapping.
4. Add server-side validation for query params (`week`, `sortBy`, filters, pagination).
5. Add tests:
   - SQL repository tests (or integration tests)
   - API contract tests
   - UI data mapping tests for severity/fix-status normalization.

## 11. Risks and Edge Cases
- Multiple scans per component/week can inflate counts if latest-scan logic is not applied.
- Null severities or unexpected fix status values can break filters unless normalized.
- Week as text must follow a strict format (`YYYY-WNN`) for deterministic sorting.
- Project slug routing should be case-insensitive and URL-decoded.

## 12. Acceptance Criteria
- Dashboard project counts match aggregated DB values for selected week.
- Dashboard sort/filter behavior matches current UI controls.
- Drilldown totals and trend reflect same project/week and same latest-scan policy.
- Drilldown filters and pagination return stable, deterministic results.
- No mock data dependency remains for dashboard/drilldown pages.
