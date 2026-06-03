# System Design - Twistlock Report and Vulnerability Dashboard

Version: 3.0  
Date: 2026-05-26  
Status: Implemented (matches current codebase)

## 1. Scope

This document describes the system currently implemented in this repository:

- Twistlock username/password login
- Session-protected dashboard and drilldown views
- Report generation workflow backed by project-image mapping tables
- System settings CRUD for project/image/tag mapping
- IAM-based UI action gating for create, update, and delete in system settings

## 2. Architecture Overview

The app is a Next.js 16 App Router application that serves UI pages and API routes from the same deployment unit.

```mermaid
flowchart LR
  U[Browser Client] --> P1["/"]
  U --> P2["/dashboard"]
  U --> P3["/report"]
  U --> P4["/system_settings"]

  P1 --> A1["/api/auth/login"]
  P2 --> A2["/api/dashboard/portfolio"]
  P2 --> A3["/api/dashboard/drilldown/:project"]
  P3 --> A4["/api/report/projects"]
  P3 --> A5["/api/search-images"]
  P3 --> A6["/api/generate-report"]
  P4 --> A7["/api/components"]
  P4 --> A8["/api/components/:id"]
  P4 --> A9["/api/iam/permissions"]

    A1 --> T[Twistlock API]
    A5 --> T
    A6 --> T

    A2 --> D[(PostgreSQL)]
    A3 --> D
    A4 --> D
    A7 --> D
    A8 --> D
    A9 --> D
```

## 3. Runtime and Deployment Model

- Framework: Next.js 16.1.6 + React 19.2.3
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui primitives
- Database access: `pg` Pool via server-side `lib/db.ts`
- Report output: `.docx` generated with `docxtemplater` + `pizzip`
- API execution mode: Node.js runtime for server routes that touch DB, filesystem, or heavy logic

## 4. Frontend Route Map

Implemented page routes:

- `/` login and product entry
- `/docs` usage guide
- `/dashboard` portfolio view
- `/dashboard/drilldown/[project]` project drilldown
- `/report` project selection for report generation
- `/report/find-repository` report form with optional pre-selected project
- `/report/generate` report form with auto-search on mount
- `/system_settings` mapping administration page
- `/logout` clears session and redirects to `/`

## 5. Session and Authentication Design

Authentication flow uses Twistlock credentials and stores the returned token in browser `sessionStorage`.

- Token key: `twistlockToken`
- Username key: `twistlockUsername`
- Session guard: `useSessionAuth` redirects to `/` when token is missing

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant AuthRoute as /api/auth/login
    participant Twistlock

    User->>Browser: Submit username/password
    Browser->>AuthRoute: POST credentials
    AuthRoute->>Twistlock: POST /api/v1/authenticate
    Twistlock-->>AuthRoute: token
    AuthRoute-->>Browser: { token }
    Browser->>Browser: sessionStorage.setItem(twistlockToken)
    Browser->>Browser: sessionStorage.setItem(twistlockUsername)
    Browser->>Browser: navigate to /dashboard
```

## 6. API Surface

### 6.1 Twistlock Proxy APIs

- `POST /api/auth/login`
  - Validates login payload with Zod
  - Calls `authenticate` in `lib/twistlock.ts`

- `POST /api/search-images`
  - Input: `{ projectName, twistlockToken }`
  - Resolves project image list from DB via `listProjectImageNames`
  - Calls Twistlock registry search by image name via `searchByImageNames`

- `POST /api/generate-report`
  - Supports single-image and batch payloads
  - For each selection: `resolveRegistry` then `getScanResult`
  - Generates `.docx` in-memory and streams as file response

### 6.2 Dashboard APIs

- `GET /api/dashboard/portfolio`
  - Query: `week`, `sortBy`, `hasIssuesOnly`
  - Returns week, trend weeks, and per-project severity counts + trend array

- `GET /api/dashboard/drilldown/[project]`
  - Query: `week`, `severities`, `component`, `fixStatus`, `q`, `page`, `pageSize`
  - Returns totals, trend detail, filter options, paginated rows, and pagination metadata

### 6.3 Report and Settings APIs

- `GET /api/report/projects`
  - Returns project list from mapping tables

- `GET /api/components`
- `POST /api/components`
- `POST /api/components/by-image`
- `PATCH /api/components/[id]`
- `DELETE /api/components/[id]`
  - CRUD on project-image-tag mapping data via `lib/components-api.ts`

- `POST /api/components/by-image`
  - Input: `{ imageName, currentTag, isProd? }`
  - Finds an existing `image_tag_mapping` record by `image_name`
  - If no record exists for `imageName`, returns 404
  - Reuses the matched row's `project_image_mapping_id` to insert a new `image_tag_mapping` row
  - Writes `created_at` using server timestamp (`CURRENT_TIMESTAMP`)
  - Returns 409 if `(project_image_mapping_id, current_tag)` already exists

- `GET /api/iam/permissions`
  - Query: `username`, `service`
  - Returns `{ canCreate, canUpdate, canDelete }`

- `GET /api/ping`
  - Health endpoint

## 6A. Implementation - Twistlock Report

This section maps the implemented Twistlock Report feature end to end.

### UI implementation

- Entry page and login handoff: `app/page.tsx`, `components/LoginForm.tsx`
- Report project selection page: `app/report/page.tsx`
- Report generation pages: `app/report/find-repository/page.tsx`, `app/report/generate/page.tsx`
- Main report interaction component: `components/ReportForm.tsx`

### Server implementation

- Login route: `app/api/auth/login/route.ts`
- Project list route (DB-backed): `app/api/report/projects/route.ts`
- Image search route: `app/api/search-images/route.ts`
- Report generation route: `app/api/generate-report/route.ts`

### Domain/service modules

- Twistlock client: `lib/twistlock.ts`
- Report builder and template rendering: `lib/report-builder.ts`
- Project-to-image mapping lookup: `lib/report-projects.ts`
- Input schemas: `lib/validators.ts`

### Implementation flow

```mermaid
sequenceDiagram
    participant UI as ReportForm UI
    participant API1 as /api/report/projects
    participant API2 as /api/search-images
    participant API3 as /api/generate-report
    participant DB as PostgreSQL
    participant TW as Twistlock API
    participant RB as report-builder

    UI->>API1: GET projects
    API1->>DB: listReportProjects()
    DB-->>API1: projects + image names
    API1-->>UI: project cards

    UI->>API2: POST projectName + token
    API2->>DB: listProjectImageNames(project)
    DB-->>API2: image names
    API2->>TW: searchByImageNames(imageNames, token)
    TW-->>API2: tags per image
    API2-->>UI: repository/tag options

    UI->>API3: POST selections + token
    loop each selected image:tag
      API3->>TW: resolveRegistry
      API3->>TW: getScanResult
    end
    API3->>RB: buildCombinedReport(...)
    RB-->>API3: docx buffer
    API3-->>UI: file attachment response
```

## 7. ER Diagram and Database Design

### 7.1 ER Diagram

```mermaid
erDiagram
  project_image_mapping {
    int id PK
    text project
    text image_name
    timestamptz created_at
  }

  image_tag_mapping {
    int id PK
    int project_image_mapping_id FK
    text image_name
    text current_tag
    boolean is_prod
    timestamptz created_at
  }

  scans {
    int id PK
    int component_id
    text week
    timestamptz scanned_at
    int vuln_count
    text scanned_tag
  }

  vulnerabilities {
    int id PK
    int scan_id
    text cve_id
    text severity
    numeric cvss
    text package_name
    text package_version
    text fix_status
    text description
    text image_id
    text image_name
  }

  iam {
    bigint id PK
    varchar username
    varchar service
    varchar role
  }

  project_image_mapping ||--o{ image_tag_mapping : maps
  image_tag_mapping ||--o{ scans : scanned_as
  scans ||--o{ vulnerabilities : contains
```

### 7.2 Logical Design

- `project_image_mapping` is the canonical project-to-image table with uniqueness on `(project, image_name)`.
- `image_tag_mapping` stores tags for each mapped image and supports multiple tags per image via `(project_image_mapping_id, current_tag)` uniqueness.
- `scans` stores periodic snapshots keyed by `week` and `component_id`.
- `vulnerabilities` stores per-scan findings keyed by `scan_id`.
- `iam` stores per-user per-service role strings used to derive CRUD permissions.

### 7.3 Keys and Constraints

- Primary keys:
  - `project_image_mapping.id`
  - `image_tag_mapping.id`
  - `scans.id`
  - `vulnerabilities.id`
  - `iam.id`
- Unique constraints:
  - `project_image_mapping (project, image_name)`
  - `image_tag_mapping (project_image_mapping_id, current_tag)`
- Foreign keys:
  - Enforced: `image_tag_mapping.project_image_mapping_id -> project_image_mapping.id`
  - Logical/expected by query model:
    - `scans.component_id -> image_tag_mapping.id`
    - `vulnerabilities.scan_id -> scans.id`

### 7.4 Query-Oriented Indexing Strategy

To support current dashboard and report workloads, keep these indexes in place (or add if missing):

- `scans (week, component_id, scanned_at DESC)` for latest-scan-per-component queries.
- `vulnerabilities (scan_id, severity, cve_id)` for drilldown filters and dedupe.
- `project_image_mapping (project, image_name)` backed by the unique constraint.
- `image_tag_mapping (project_image_mapping_id, current_tag)` backed by the unique constraint.
- `iam (LOWER(username), LOWER(service))` for permission lookup endpoint behavior.

### 7.5 Database Design Notes for Current Implementation

- Dashboard queries intentionally deduplicate by component and CVE to avoid over-counting across repeated scan rows.
- Components/system settings writes demote prior production tags when setting a new `is_prod=true` mapping row.
- Migration scripts preserve historical IDs and reset sequences using `setval(...)` after backfill.

## 8. Report Generation Pipeline

`lib/report-builder.ts` fills `lib/template.docx` with scan data.

- Normalizes potentially broken split placeholders in the Word XML
- Injects loop markers for microservice rows in combined mode
- Sorts vulnerabilities by severity order: critical, high, medium, low
- Produces a single combined document for selected repositories

```mermaid
flowchart TD
    A[User selects repos and tags] --> B["/api/generate-report"]
    B --> C[Validate request schema]
    C --> D{Batch or single}
    D -->|Batch| E[Loop selections]
    D -->|Single| F[Single selection]
    E --> G[resolveRegistry]
    F --> G
    G --> H[getScanResult]
    H --> I[buildCombinedReport or buildReport]
    I --> J[Return docx attachment response]
```

## 9. Dashboard and Drilldown Processing

Portfolio and drilldown both read from PostgreSQL and return UI-friendly payloads.

- Portfolio:
  - latest available week fallback when week is omitted
  - severity counts per project
  - 8-week trend generation
  - sorting and has-issues filtering

- Drilldown:
  - resolves canonical project from slug
  - totals by severity
  - 8-week severity trend detail
  - component/fix-status filter options
  - search + pagination on deduped vulnerability rows

## 9A. Implementation - Vulnerability Dashboard

This section maps the implemented dashboard feature from UI to SQL-backed aggregation.

### UI implementation

- Portfolio page shell: `app/dashboard/page.tsx`
- Portfolio table and sparkline UI: `app/dashboard/_components/PortfolioOverviewDesign.tsx`
- Drilldown page shell: `app/dashboard/drilldown/[project]/page.tsx`
- Drilldown analytics UI: `app/dashboard/_components/ProjectDrilldownDesign.tsx`
- Dashboard client data hooks: `app/dashboard/_hooks/useDashboardApi.ts`

### Server implementation

- Portfolio API: `app/api/dashboard/portfolio/route.ts`
- Drilldown API: `app/api/dashboard/drilldown/[project]/route.ts`
- Query and aggregation logic: `lib/dashboard-api.ts`

### Data/aggregation behavior implemented

- Resolves latest available week when week is omitted
- Uses latest scan per component for a given week
- Deduplicates vulnerability rows by component and CVE key patterns
- Produces severity totals and 8-week trend payloads
- Supports drilldown filters for severity, component, fix status, text search, and pagination

### Implementation flow

```mermaid
flowchart TD
    A[Dashboard UI] --> B[usePortfolioData hook]
    B --> C["/api/dashboard/portfolio"]
    C --> D["lib/dashboard-api getPortfolioPayload"]
    D --> E["(scans, vulnerabilities, image_tag_mapping, project_image_mapping)"]
    E --> D
    D --> C
    C --> B
    B --> A

    F[Drilldown UI] --> G[useDrilldownData hook]
    G --> H["/api/dashboard/drilldown/:project"]
    H --> I["lib/dashboard-api getDrilldownPayload"]
    I --> E
    E --> I
    I --> H
    H --> G
    G --> F
```

## 10. Security and Operational Design

- Credentials are exchanged only through server route `POST /api/auth/login`
- Twistlock token and username are client session-scoped (`sessionStorage`)
- Token is not persisted in DB by application logic
- DB access is server-side only through pooled connections
- API input validation uses Zod on request boundaries
- Runtime errors are mapped to user-facing JSON errors and HTTP status codes

## 11. CLI Batch Reporting

The script `scripts/generate-reports.ts` supports non-UI report generation:

- Optional project filtering via `--projects`
- Reads config from `projects.config.json`
- Authenticates once and generates per-project combined reports
- Writes outputs under `reports/YYYY-MM-DD/`

## 12. Known Implementation Constraints

- `useSessionAuth` currently assumes token presence in session storage and redirects when missing.
- Report generation route performs sequential Twistlock fetches per selected image/tag.
- Dashboard data quality depends on weekly scan ingestion consistency in DB tables.
- System settings permissions are client-evaluated for UI controls; server route authorization policy should remain enforced by backend logic and environment controls.

## 13. Summary

This implementation is a unified Next.js application with:

- Session-scoped Twistlock authentication
- DB-backed vulnerability analytics dashboard
- DB-backed report project mapping and administration
- In-memory `.docx` report generation from Twistlock scan data

The implementation is delivered as two primary product capabilities:

- Twistlock Report generation workflow
- Vulnerability Dashboard and project drilldown analytics workflow

All architecture and sequence diagrams in this document are Mermaid-based by design.