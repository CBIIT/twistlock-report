# Product Requirements Document

## Product Name

Twistlock Vulnerability Dashboard

## Document Status

Draft

## Last Updated

2026-05-04

## 1. Purpose

Build a web-based vulnerability reporting dashboard that gives security, TPM, and engineering stakeholders a weekly view of container vulnerability posture by project and repository component. The product should help users quickly answer three questions:

- Which projects currently have the highest security risk?
- How is vulnerability risk trending over time?
- Which specific vulnerabilities are driving risk within a selected project?

The dashboard must support both a portfolio-level overview and a project-level drilldown experience.

## 2. Background

The UI concept in `ui.ts` defines a two-level workflow:

- A weekly summary dashboard listing projects with counts of critical, high, medium, and low vulnerabilities.
- A drilldown page for a selected project showing severity summary cards, an 8-week trend view, and a filterable vulnerability table.

This product formalizes that UI into a reporting application for weekly operational review and remediation planning.

## 3. Goals

- Provide a single weekly dashboard for vulnerability visibility across projects.
- Surface the highest-risk projects first through sorting and filtering.
- Allow users to drill into a project and inspect vulnerability details without leaving the reporting flow.
- Show short-term trend movement over 8 weeks so teams can detect improvement or regression.
- Support remediation prioritization using severity, CVE identifier, CVSS score, affected component, and package data.

## 4. Non-Goals

- This release does not include editing vulnerabilities or remediation tickets directly in the UI.
- This release does not define role-based access control or multi-tenant administration.
- This release does not include custom chart builders or arbitrary date-range analytics beyond the defined weekly trend window.
- This release does not replace the upstream scanning platform; it presents reporting and analysis derived from scan results.

## 5. Target Users

### Primary Users

- Security analysts reviewing weekly risk posture.
- TPMs tracking project-level security status.
- Engineering leads triaging critical and high vulnerabilities.

### Secondary Users

- Program managers preparing weekly or monthly status reviews.
- Compliance or governance stakeholders reviewing vulnerability trends.

## 6. User Problems

- Users need to compare vulnerability exposure across many projects in one place.
- Users need to identify which projects have unresolved critical or high vulnerabilities.
- Users need to see whether project risk is improving or worsening over recent weeks.
- Users need enough detail in the drilldown to decide which components and packages to prioritize.

## 7. User Stories

- As a security analyst, I want to sort projects by critical vulnerabilities so I can review the highest-risk projects first.
- As a TPM, I want to filter the dashboard to only projects with issues so I can avoid noise from healthy projects.
- As an engineering lead, I want to open a project drilldown and see severity totals and trends so I can understand whether my team's posture is improving.
- As a remediation owner, I want to filter the vulnerability table by severity and component so I can focus on the most relevant issues.
- As a reviewer, I want searchable and paginated results so I can inspect large vulnerability lists efficiently.

## 8. Product Scope

The product contains two primary screens.

### 8.1 Portfolio Dashboard

The dashboard presents one row per project for a given reporting week. Each row includes:

- Project name.
- Critical vulnerability count.
- High vulnerability count.
- Medium vulnerability count.
- Low vulnerability count.
- An 8-week sparkline trend summary.

The dashboard also includes:

- A visible reporting period label, for example `Week: 2026-W17`.
- Sorting controls, with `Critical` shown as the default example in the UI concept.
- A filter control that supports at minimum `Has issues`.
- A row affordance indicating drilldown navigation into a selected project.

### 8.2 Project Drilldown

The drilldown page presents detailed data for one selected project and one selected reporting week. It includes:

- Breadcrumb or back navigation to return to the dashboard.
- Project identifier and selected reporting week.
- Four summary cards for Critical, High, Medium, and Low counts.
- An 8-week line chart labeled `Vulnerability Trend`.
- Severity series toggles for at least Critical, High, Medium, and Low.
- A vulnerability table with filters, search, and pagination.

The table includes, at minimum, the following columns:

- Component
- CVE
- Severity
- CVSS
- Package

## 9. Functional Requirements

### 9.1 Weekly Context

- The system must display the active reporting week on both the dashboard and drilldown views.
- The system must show data scoped to a single weekly reporting snapshot unless a future enhancement expands the date model.

### 9.2 Dashboard Summary Table

- The system must list projects in a tabular summary view.
- The system must show counts by severity for each project.
- The system must show a compact 8-week trend indicator per project.
- The system must allow sorting by at least one severity metric.
- The system should default to sorting by critical vulnerabilities descending.
- The system must allow filtering to projects that currently have issues.
- Selecting a project row must open the project drilldown view.

### 9.3 Drilldown Severity Cards

- The system must show four summary cards for Critical, High, Medium, and Low vulnerabilities.
- Each severity card must display the count for the selected week.
- Severity cards should use distinct visual treatments aligned with severity meaning, such as red for critical and amber for high.

### 9.4 Trend Visualization

- The system must show an 8-week trend chart for the selected project.
- The chart must support viewing vulnerability levels over time.
- The chart must provide series selection by severity.
- The chart may support multiple component or source lines if the underlying data model provides them.

### 9.5 Vulnerability Table

- The system must display a vulnerability list for the selected project.
- The system must support severity filters for Critical, High, Medium, and Low.
- The system must support filtering by component.
- The system must support filtering by fix status or fix availability.
- The system must support free-text search within the visible vulnerability dataset.
- The system must paginate results.
- The system must show the current result count, such as `Showing 15 of 68`.

### 9.6 Vulnerability Record Fields

Each vulnerability record should support the following fields where available:

- Project
- Component
- CVE identifier
- Severity
- CVSS score
- Package name
- Package version
- Fix status
- Discovery date
- Reporting week

Only the fields visibly required by the table must be shown by default. Additional fields may be used for filtering, search, exports, or future details panels.

## 10. Data Requirements

### 10.1 Aggregated Project Data

For each project and week, the system needs:

- Project name
- Weekly counts by severity
- Eight weeks of historical counts for trend rendering

### 10.2 Detailed Vulnerability Data

For each project vulnerability record, the system needs:

- Component or service name
- CVE identifier
- Severity label
- CVSS numeric value
- Package name
- Optional package version
- Optional fix status
- Optional source classification if lines are grouped by backend, frontend, files, or interoperation

## 11. Interaction Requirements

- Users must be able to navigate from the dashboard to the drilldown in one action.
- Users must be able to refine drilldown results without page reload if the application architecture supports it.
- Users must be able to combine filters with search.
- Users must be able to clear filters and return to the baseline project view.
- Pagination controls must support moving to previous and next result pages.

## 12. Visual and UX Requirements

- The dashboard must prioritize scannability for weekly review meetings.
- Severity must be consistently color-coded across summary cards, charts, and table labels.
- The layout must remain legible when a project has zero counts for one or more severities.
- Trend visuals must remain readable with 8 weeks of data.
- The UI should clearly distinguish overview data from project-specific detail data.

## 13. Success Metrics

- Users can identify the highest-risk project from the dashboard in under 30 seconds.
- Users can open a project drilldown and isolate critical vulnerabilities using filters in under 3 interactions.
- Weekly review users can compare current and prior trend posture for a project without leaving the drilldown view.
- The dashboard renders data for all projects in the reporting scope without truncating critical risk information.

## 14. Acceptance Criteria

### Dashboard

- [ ] A weekly label is visible on the main dashboard.
- [ ] Each project row shows counts for Critical, High, Medium, and Low.
- [ ] Each project row shows a compact 8-week trend indicator.
- [ ] Users can sort the dashboard by at least one severity count.
- [ ] Users can filter the dashboard to projects with issues.
- [ ] Selecting a project opens the drilldown view.

### Drilldown

- [ ] The drilldown shows the selected project name and reporting week.
- [ ] The drilldown shows four severity summary cards with counts.
- [ ] The drilldown includes an 8-week trend chart.
- [ ] Users can toggle or select severity series in the trend view.
- [ ] The vulnerability table includes Component, CVE, Severity, CVSS, and Package columns.
- [ ] Users can filter the table by severity.
- [ ] Users can filter the table by component.
- [ ] Users can filter the table by fix status.
- [ ] Users can search vulnerability results.
- [ ] Users can paginate through the vulnerability list.
- [ ] The UI shows how many results are currently displayed out of the total.

## 15. Assumptions and Open Questions

### Assumptions

- Reporting data is refreshed on a weekly cadence.
- The source system can provide both project-level aggregates and detailed vulnerability records.
- Project names, component names, and severity labels are normalized before rendering.

### Open Questions

- What is the authoritative source for weekly historical trend data?
- Should drilldown trends be grouped only by severity, or also by component category such as backend and frontend?
- Does the table require export capability in the initial release?
- Should `Has issues` include only critical and high findings, or any non-zero severity count?
- Is fix status sourced directly from the scanner, or derived from package intelligence?

## 16. Future Enhancements

- Export dashboard and drilldown results to CSV or DOCX.
- Add saved filters for common review workflows.
- Add ownership metadata such as TPM, team, or repository owner.
- Add ticketing integration for remediation tracking.
- Add SLA views for time-to-fix by severity.