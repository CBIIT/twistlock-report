# Design Preview

This folder contains a front-end design prototype for the Twistlock Vulnerability Dashboard based on:

- `docs/product-requirements-05-04.md`
- `docs/ui.ts`

## Preview route

Open `/dashboard` in the app to view the portfolio page.

Open `/dashboard/drilldown/icdc` to view the project drilldown page.

## Scope mapped from PRD

- Portfolio dashboard with weekly label, sorting, has-issues filter, and 8-week sparkline per project.
- Project drilldown with severity summary cards and an 8-week trend chart.
- Vulnerability table with severity/component/fix filters, search, pagination, and result count.

## Routes

- `/dashboard`: Portfolio risk overview page.
- `/dashboard/drilldown/[project]`: Project drilldown page.
	- Example: `/dashboard/drilldown/icdc`

## Files

- `app/dashboard/_components/PortfolioOverviewDesign.tsx`: portfolio risk overview page UI.
- `app/dashboard/_components/ProjectDrilldownDesign.tsx`: project drilldown page UI.
- `app/dashboard/_data/dashboard-data.ts`: shared mock data and dashboard types.
- `app/dashboard/page.tsx`: portfolio route entry.
- `app/dashboard/drilldown/[project]/page.tsx`: drilldown route entry.
