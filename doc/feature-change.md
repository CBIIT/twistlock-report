# Feature Change — Project-Based Repository Search & Batch Report Generation

**Version:** 2.0  
**Date:** March 21, 2026  
**Status:** Proposed  
**Depends on:** System Design v1.0

---

## 1. Overview

Currently the user must manually enter a single **Repository (imageName)** and **Image Tag** to generate one scan report at a time. This enhancement introduces a **project-based search** workflow where the user enters a project name (e.g., "C3DC"), the system queries Twistlock for all matching repositories, and presents the results as a selectable checklist with tag dropdowns — enabling batch report generation in a single session.

### Goals

- Reduce manual effort for users managing multiple repositories under one project
- Auto-discover repositories and their most recent image tags from Twistlock
- Allow selective generation (all or some repositories)
- Default to all repositories selected with the most recent tag pre-chosen

---

## 2. UX Flow

### 2.1 Two-Phase Form

The form changes from a single-step submission to a two-phase workflow:

```
Phase 1: Search                    Phase 2: Select & Generate
┌─────────────────────────┐        ┌──────────────────────────────────────┐
│ Project Name  [C3DC    ]│        │ ☑ Select All / ☐ Deselect All       │
│ TPM           [J. Doe  ]│        │                                      │
│ Token         [••••••••]│        │ ☑ ccdi-federation-dcc  [1.2.0.10 ▾] │
│                         │  ───►  │ ☑ ccdi-hub-backend     [2.1.0    ▾] │
│ [🔍 Search Repos]       │        │ ☑ ccdi-hub-frontend    [3.0.1    ▾] │
└─────────────────────────┘        │ ☐ ccdi-old-service     [1.0.0    ▾] │
                                   │                                      │
                                   │ [Generate Reports (3)]               │
                                   └──────────────────────────────────────┘
```

### 2.2 Default Selection Behavior

| Behavior | Default |
|---|---|
| Repository checkbox | **All checked** |
| Tag dropdown | **Most recent tag** (by `creationTime`) pre-selected |
| Select All toggle | Checks/unchecks all repositories at once |
| Generate button | Shows count of selected repositories |

### 2.3 User Flow

1. User enters **Project Name**, optional **TPM**, and **Twistlock Token**
2. Clicks **"Search Repositories"**
3. System queries Twistlock API, groups results by repository, returns top 5 tags per repo (sorted by image created time)
4. UI displays a checklist table — all repos checked, most recent tag selected
5. User optionally unchecks repos or changes tags
7. Clicks **"Generate Report (N)"**
8. System fetches scan data for all selected repo+tags and builds one combined `.docx`, triggering a single download
9. Success banner shows summary: "Report generated with 3 repositories"

---

## 3. Backend Changes

### 3.1 New API Route: `POST /api/search-images`

**File:** `app/api/search-images/route.ts`

**Request:**

```json
{
  "projectName": "C3DC",
  "twistlockToken": "eyJ..."
}
```

**Response (200):**

```json
{
  "repositories": [
    {
      "repo": "ccdi-federation-dcc",
      "tags": [
        { "tag": "1.2.0.10", "creationTime": "2026-02-25T15:23:52.93Z" },
        { "tag": "1.2.0.9",  "creationTime": "2026-02-20T10:15:00.000Z" },
        { "tag": "1.2.0.8",  "creationTime": "2026-02-15T09:30:00.000Z" }
      ]
    },
    {
      "repo": "ccdi-hub-backend",
      "tags": [
        { "tag": "2.1.0", "creationTime": "2026-02-22T18:00:00.000Z" }
      ]
    }
  ]
}
```

**Error responses** follow the same pattern as the existing `/api/generate-report`:

| Status | Condition |
|---|---|
| 400 | Missing or invalid input |
| 401 | Bad Twistlock token |
| 404 | No repositories found for project name |
| 500 | Unexpected error |

### 3.2 New Lib Function: `searchByProject()`

**File:** `lib/twistlock.ts`

```typescript
export async function searchByProject(
  projectName: string,
  token: string
): Promise<ProjectSearchResult[]>
```

- Calls `GET /api/v1/registry` with `search={projectName}` (broad search)
- Groups response items by `repoTag.repo`
- De-duplicates tags per repo, sorts by `creationTime` (image created time) descending
- Returns top 5 tags per repository

### 3.3 Updated Route: `POST /api/generate-report`

**File:** `app/api/generate-report/route.ts`

The endpoint is updated to accept **batch input** — an array of selected repositories — and return a **single combined `.docx`** containing all scan reports.

**Request:**

```json
{
  "projectName": "C3DC",
  "tpm": "J. Doe",
  "selections": [
    { "imageName": "ccdi-federation-dcc", "imageTag": "1.2.0.10" },
    { "imageName": "ccdi-hub-backend",    "imageTag": "2.1.0" },
    { "imageName": "ccdi-hub-frontend",   "imageTag": "3.0.1" }
  ],
  "twistlockToken": "eyJ..."
}
```

**Response:** A single `.docx` file combining the scan report sections for every selected repo+tag. Each repo's vulnerabilities appear under their own heading within the document.

---

## 4. Frontend Changes

### 4.1 New Types

**File:** `types/twistlock.ts`

```typescript
export interface TagInfo {
  tag: string;
  creationTime: string;
}

export interface ProjectSearchResult {
  repo: string;
  tags: TagInfo[];
}
```

**File:** Add `RegistrySearchItem.scanTime` and `RegistrySearchItem.creationTime` fields (already in API response but not typed).

### 4.2 New Validator: `searchFormSchema`

**File:** `lib/validators.ts`

```typescript
export const searchFormSchema = z.object({
  projectName:    z.string().min(1, "Project name is required"),
  tpm:            z.string().optional(),
  twistlockToken: z.string().min(1, "Twistlock token is required"),
});
```

### 4.3 Component Changes: `ReportForm.tsx`

The form component gains two phases managed by local state:

**State additions:**

```typescript
type RepoSelection = {
  repo: string;
  availableTags: string[];
  selectedTag: string;
  checked: boolean;
};

const [phase, setPhase] = useState<"search" | "select">("search");
const [repos, setRepos] = useState<RepoSelection[]>([]);
```

**Phase 1:** Renders project name, TPM, and token fields + "Search Repositories" button.

**Phase 2:** Renders a checklist table with:
- Checkbox per repository row
- Tag dropdown per row (populated with up to 5 most recent tags)
- "Select All" / "Deselect All" toggle
- "Generate Reports (N)" button with count of checked repos
- "← Back to Search" link to return to Phase 1

**Generation:** Sends all checked repos+tags in a single `POST /api/generate-report` request. The server resolves each image, fetches scan results, and builds one combined `.docx`. The client downloads the single file and shows a summary banner.

---

## 5. Data Flow (Updated)

```
User enters project name + token
      │
      ▼
POST /api/search-images
      │
      ▼
Server: GET Twistlock /api/v1/registry?search={projectName}
      │
      ▼
Server: Group by repo, sort tags by creationTime desc, return top 5
      │
      ▼
Client: Display repo checklist (all checked, most recent tag selected)
      │
      ▼
User selects/deselects repos, changes tags
      │
      ▼
Click "Generate Report"
      │
      ▼
POST /api/generate-report  (batch: all selected repo+tags)
      │
      ▼
Server: For each selection → resolve registry → fetch scan result
      │
      ▼
Server: Build single combined .docx with all repo sections
      │
      ▼
Client: Download one .docx file
      │
      ▼
Show summary banner: "Report generated with N repositories"
```

---

## 6. File Changes Summary

| File | Action | Description |
|---|---|---|
| `types/twistlock.ts` | **Modify** | Add `scanTime`, `creationTime` to `RegistrySearchItem`; add `TagInfo`, `ProjectSearchResult` types |
| `lib/twistlock.ts` | **Modify** | Add `searchByProject()` function |
| `lib/validators.ts` | **Modify** | Add `searchFormSchema` |
| `app/api/search-images/route.ts` | **New** | Search endpoint returning grouped repos + tags |
| `components/ReportForm.tsx` | **Modify** | Two-phase UI: search → checklist → batch generate |
| `lib/report-builder.ts` | **Modify** | Support building a combined report from multiple scan results |
| `app/api/generate-report/route.ts` | **Modify** | Accept batch selections array, return single combined `.docx` |
| `app/page.tsx` | **No change** | Still renders `<ReportForm />` |

---

## 7. Security Considerations

- The Twistlock token is used identically to v1 — sent in the POST body over HTTPS, used only server-side, never logged
- The search endpoint does not expose any additional data beyond what the user's token already grants access to
- Project name search is URL-encoded before being sent to the Twistlock API (no injection risk)
- Batch report generation is processed server-side in a single request, preventing server overload

---

## 8. Future Enhancements

- **Project name autocomplete:** Cache known project prefixes for faster search
- **Saved project configurations:** Remember project-to-repo mappings for repeat users
- **Parallel generation:** Generate reports concurrently (with rate limiting) for faster batch processing
