# Implementation Plan — Twistlock Container Scan Report Generator

**Version:** 1.0  
**Date:** March 12, 2026  
**Reference:** [system-design.md](system-design.md)

---

## Overview

This plan breaks the implementation into 5 sequential phases. Each phase has clear deliverables and can be reviewed independently before moving to the next. Estimated effort is noted per task for planning purposes.

| Phase | Description | Deliverable |
|---|---|---|
| 1 | Project scaffolding & tooling setup | Runnable empty Next.js app on Vercel |
| 2 | TypeScript types & data layer | Typed Twistlock API client, validated |
| 3 | Report generation | Filled `.docx` output from real API data |
| 4 | Frontend UI | Working form with all states |
| 5 | End-to-end integration & deployment | Live app on Vercel, QA complete |

---

## Phase 1 — Project Scaffolding

**Goal:** Create a working Next.js project with all dependencies installed, linting configured, and an initial Vercel deployment wired to the Git repository. No business logic yet.

### Tasks

#### 1.1 — Bootstrap Next.js project

```bash
pnpm create next-app@latest twistlock-report-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd twistlock-report-app
```

#### 1.2 — Install dependencies

```bash
# Report generation
pnpm add docxtemplater pizzip

# Form handling & validation
pnpm add react-hook-form zod @hookform/resolvers

# UI components (shadcn/ui — run interactively)
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input form label alert
```

#### 1.3 — Configure `next.config.ts`

Add the `outputFileTracingIncludes` entry so Vercel bundles the Word template with the serverless function (see system-design §6.5):

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/generate-report": ["./lib/template.docx"],
    },
  },
};

export default nextConfig;
```

#### 1.4 — Set up `vercel.json`

```json
{
  "functions": {
    "app/api/generate-report/route.ts": {
      "maxDuration": 60
    }
  }
}
```

#### 1.5 — Create directory structure

Create the empty files and folders defined in system-design §3 so the structure is in place before filling them in:

```bash
mkdir -p app/api/generate-report components/ui lib types
touch app/api/generate-report/route.ts
touch components/ReportForm.tsx components/StatusBanner.tsx
touch lib/twistlock.ts lib/report-builder.ts lib/validators.ts lib/utils.ts
touch types/twistlock.ts
touch .env.example
cp .env.example .env.local
```

#### 1.6 — Create `.env.example`

```bash
# No required server-side secrets for the base application.
# TWISTLOCK_BASE_URL=https://twistlock.nci.nih.gov
```

#### 1.7 — Push to GitHub and connect Vercel

1. Create a new GitHub repository.
2. Push the scaffolded project:
   ```bash
   git init && git add . && git commit -m "chore: initial scaffolding"
   git remote add origin https://github.com/<org>/twistlock-report-app.git
   git push -u origin main
   ```
3. In Vercel Dashboard → **Add New Project** → import the repository.
4. Accept auto-detected Next.js settings. Deploy.
5. Confirm the deployment URL is live (shows the default Next.js page).

**Phase 1 exit criteria:**
- `pnpm dev` runs without errors at `localhost:3000`
- App is deployed and accessible on Vercel
- All dependencies are installed and `pnpm build` succeeds

---

## Phase 2 — TypeScript Types & Data Layer

**Goal:** Implement all server-side data logic — TypeScript types for Twistlock API responses, the Zod validation schema, and the Twistlock API client. Test each function in isolation using real API responses from the sample JSON files.

### Tasks

#### 2.1 — Define TypeScript types (`types/twistlock.ts`)

Model the Twistlock API response shapes based on `scan-result.json` and `registry-respons.json`:

```typescript
export interface RepoTag {
  registry: string;
  repo:     string;
  tag:      string;
}

export interface RegistrySearchItem {
  repoTag: RepoTag;
}

export interface Vulnerability {
  cve:            string;
  severity:       "critical" | "high" | "medium" | "low";
  cvss:           number;
  status:         string;
  packageName:    string;
  packageVersion: string;
  description:    string;
  link:           string;
  discovered:     string;   // ISO 8601
}

export interface TwistlockScanResult {
  _id:                    string;
  scanTime:               string;
  distro:                 string;
  vulnerabilities:        Vulnerability[] | null;
  vulnerabilitiesCount:   number;
  repoTag:                RepoTag;
}
```

#### 2.2 — Define Zod validation schema (`lib/validators.ts`)

```typescript
import { z } from "zod";

export const reportFormSchema = z.object({
  projectName:      z.string().min(1, "Project name is required"),
  tpm:              z.string().min(1, "TPM name is required"),
  microserviceName: z.string().min(1, "Microservice name is required"),
  imageName:        z.string().min(1, "Image name is required"),
  imageTag:         z.string().min(1, "Image tag is required"),
  twistlockToken:   z.string().min(1, "Twistlock token is required"),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;
```

#### 2.3 — Implement shared utilities (`lib/utils.ts`)

```typescript
// Format a Date as "March 12, 2026"
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// Format a Date as "20260312" (for filenames)
export function formatDateCompact(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

#### 2.4 — Implement Twistlock API client (`lib/twistlock.ts`)

Implement `resolveRegistry()` and `getScanResult()` exactly as specified in system-design §5.2. Include the `TwistlockError` class.

Key implementation notes:
- The `search` query parameter requires double URL-encoding (dots and backslashes). Use `encodeURIComponent` on the full `name:tag` string, then replace `.` with `%5C.` and `:` with `%253A` to match the format seen in the sample URL.
- Always check `res.status === 401` before the generic `!res.ok` check.
- Never log the `token` argument.

#### 2.5 — Smoke test the API client

Before building the UI, verify the client works against the real Twistlock API by running a temporary test script:

```bash
# tmp-test.ts (delete after confirming)
import { resolveRegistry, getScanResult } from "./lib/twistlock";

const registry = await resolveRegistry("ccdi-federation-dcc", "1.2.0.10", process.env.TL_TOKEN!);
console.log("Registry:", registry);

const result = await getScanResult(registry, "ccdi-federation-dcc", "1.2.0.10", process.env.TL_TOKEN!);
console.log("Vuln count:", result.vulnerabilitiesCount);
```

Run with: `TL_TOKEN=<your_token> npx tsx tmp-test.ts`

**Phase 2 exit criteria:**
- `resolveRegistry()` returns the correct registry hostname for a known image
- `getScanResult()` returns the full scan result with the vulnerability array populated
- All TypeScript types compile without errors (`pnpm tsc --noEmit`)

---

## Phase 3 — Report Generation

**Goal:** Produce a correctly populated `.docx` file from the Word template and a real scan result. This phase is fully server-side and can be tested independently of the UI.

### Tasks

#### 3.1 — Prepare `lib/template.docx`

Open the organization's existing Word report template and insert `docxtemplater` placeholder tags:

1. In the **Project Details** table, replace the value cells with:
   `{projectName}`, `{tpm}`, `{reportDate}`

2. In the **Microservice Release Details** table, replace value cells with:
   `{microserviceName}`, `{imageName}`, `{imageTag}`, `{registry}`, `{scanDate}`, `{distro}`, `{totalVulnerabilities}`

3. In the **Security Scan Findings** table, on the **first data row** (below the header), replace each cell with:
   `{cve}`, `{severity}`, `{cvss}`, `{packageName}`, `{packageVersion}`, `{fixStatus}`, `{dateIdentified}`, `{description}`

4. Wrap the entire data row with loop markers. In the **first cell** of the row, prepend `{#vulnerabilities}`. In the **last cell**, append `{/vulnerabilities}`.

5. Save the file as `lib/template.docx`.

> **Tip:** Use a simple test render first (step 3.3) to verify placeholder names are spelled correctly before finalizing the template layout.

#### 3.2 — Implement `lib/report-builder.ts`

Implement `buildReport()` exactly as specified in system-design §6.4. Key points:
- Read `lib/template.docx` with `fs.readFileSync(templatePath, "binary")`
- Sort vulnerabilities by severity before passing to `doc.render()`
- Handle the case where `scanResult.vulnerabilities` is `null` — pass an empty array
- Return `doc.getZip().generate({ type: "nodebuffer" })`

#### 3.3 — Smoke test report generation

Create and run a temporary test script that feeds the sample `scan-result.json` directly into `buildReport()` and writes the output to disk for manual inspection:

```bash
# tmp-report-test.ts (delete after confirming)
import fs from "fs";
import scanResult from "./scan-result.json";
import { buildReport } from "./lib/report-builder";

const buf = await buildReport({
  projectName: "CRDC CCDI",
  tpm: "Jane Smith",
  microserviceName: "Federation DCC Service",
  imageName: "ccdi-federation-dcc",
  imageTag: "1.2.0.7",
  reportDate: new Date(),
  registry: "986019062625.dkr.ecr.us-east-1.amazonaws.com",
  scanResult,
});

fs.writeFileSync("test-output.docx", buf);
console.log("Written to test-output.docx");
```

Open `test-output.docx` in Word and verify:
- All three tables are populated correctly
- Vulnerability rows repeat (one row per CVE)
- Rows are sorted critical → high → medium → low
- No `{placeholder}` tags remain unfilled

**Phase 3 exit criteria:**
- `test-output.docx` opens in Word without errors
- All fields and vulnerability rows are populated correctly
- No raw placeholder text visible in the output

---

## Phase 4 — Frontend UI

**Goal:** Build the React form with all input fields, loading/success/error states, and automatic file download behavior.

### Tasks

#### 4.1 — Implement `app/page.tsx`

Render the `<ReportForm />` component inside a centered card:

```tsx
import ReportForm from "@/components/ReportForm";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold mb-6">
          Container Scan Report Generator
        </h1>
        <ReportForm />
      </div>
    </main>
  );
}
```

#### 4.2 — Implement `components/StatusBanner.tsx`

Accept `type: "success" | "error"` and `message: string` props. Use the `shadcn/ui` `Alert` component. The success banner auto-dismisses after 5 minutes via `useEffect` and `setTimeout`.

#### 4.3 — Implement `components/ReportForm.tsx`

Wire up all six fields using React Hook Form + the Zod schema from Phase 2.

Key implementation checklist:
- [ ] All six fields rendered with `<Input>` and `<FormMessage>` for inline errors
- [ ] `twistlockToken` field uses `type="password"`
- [ ] Submit handler sets a `isLoading` state flag → button disabled + spinner label "Generating…"
- [ ] On success: trigger blob download, show success `<StatusBanner>`
- [ ] On error: parse `{ error }` from JSON response, show error `<StatusBanner>`, reset button
- [ ] Filename extracted from `Content-Disposition` response header with fallback to `"ScanReport.docx"`

File download implementation (from system-design §4.2):

```typescript
const blob = await response.blob();
const disposition = response.headers.get("Content-Disposition") ?? "";
const filename = disposition.split("filename=")[1]?.replace(/"/g, "") ?? "ScanReport.docx";
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

**Phase 4 exit criteria:**
- Form renders correctly in Chrome, Firefox, and Edge
- Submitting with empty fields shows inline validation errors; API is not called
- Token field is masked
- Loading spinner appears while request is in flight
- Successful response triggers a file download
- Error responses display the correct message in the error banner

---

## Phase 5 — API Route, Integration & Deployment

**Goal:** Wire the frontend to the backend, complete end-to-end testing, and deploy to Vercel production.

### Tasks

#### 5.1 — Implement `app/api/generate-report/route.ts`

Implement the full POST handler as specified in system-design §5.1:

1. Parse and validate the request body with `reportFormSchema.safeParse()`
2. Call `resolveRegistry()` (Phase 2)
3. Call `getScanResult()` (Phase 2)
4. Call `buildReport()` (Phase 3)
5. Construct the filename: `{projectName}_{imageName}_{imageTag}_ScanReport_{YYYYMMDD}.docx`
   - Sanitize each segment: replace spaces with underscores, strip characters that are invalid in filenames
6. Return the buffer with the correct `Content-Type` and `Content-Disposition` headers
7. Wrap everything in try/catch — map `TwistlockError` to its HTTP status code; all other errors → 500

#### 5.2 — End-to-end test (local)

With `pnpm dev` running:

1. Fill in the form with valid inputs and a real Twistlock token.
2. Click **Generate Report**. Confirm spinner appears.
3. Confirm `.docx` file downloads automatically with the correct filename.
4. Open the downloaded file in Word — verify all three sections are populated.
5. Test error scenarios:
   - Wrong token → error banner: "Authentication failed…"
   - Invalid image name → error banner: "No scan record found…"
   - All fields blank → inline validation errors, no API call

#### 5.3 — Deploy to Vercel production

```bash
git add .
git commit -m "feat: complete implementation"
git push origin main
```

Vercel auto-deploys on push to `main`. After deployment:

1. Open the Vercel production URL.
2. Repeat the end-to-end test against the production deployment.
3. Confirm the serverless function timeout is respected (`vercel.json` `maxDuration: 60`).

#### 5.4 — (Optional) Configure custom domain

Follow system-design §9.4 to point a custom domain to the Vercel deployment.

**Phase 5 exit criteria:**
- Full end-to-end flow works on the Vercel production URL
- All error scenarios return the correct banner messages
- Downloaded `.docx` file is correctly named and fully populated
- No raw placeholder tags remain in the output
- No TypeScript errors (`pnpm tsc --noEmit`)
- `pnpm build` succeeds with no warnings

---

## Implementation Order Summary

```
Phase 1 — Scaffolding          (do first — unblocks all other work)
    │
    ▼
Phase 2 — Types & Data Layer   (do before Phase 3 and Phase 5)
    │
    ├──▶ Phase 3 — Report Generation   (can start once Phase 2 is done)
    │
    ├──▶ Phase 4 — Frontend UI         (can start once Phase 2 is done; independent of Phase 3)
    │
    └──▶ Phase 5 — API Route & Deploy  (requires Phases 2, 3, and 4 to be complete)
```

Phases 3 and 4 can be worked on **in parallel** once Phase 2 is complete.

---

## Definition of Done

The implementation is complete when all of the following are true:

- [ ] App is live on Vercel production URL
- [ ] All six form fields are present; all are required; token field is masked
- [ ] Form submissions with missing fields are blocked client-side with inline errors
- [ ] A valid submission fetches data from both Twistlock API endpoints and generates a `.docx`
- [ ] The `.docx` contains correctly populated Project Details, Microservice Release Details, and Security Scan Findings tables
- [ ] Vulnerabilities are sorted critical → high → medium → low
- [ ] Filename follows the convention `{ProjectName}_{ImageName}_{Tag}_ScanReport_{YYYYMMDD}.docx`
- [ ] Auth failure, image-not-found, and API error cases each show the correct error banner
- [ ] The Twistlock token is never logged, stored, or returned in any response
- [ ] `pnpm build` and `pnpm tsc --noEmit` pass with no errors
