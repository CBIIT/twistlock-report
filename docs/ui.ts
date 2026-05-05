┌──────────────────────────────────────────────────────┐
│ Vulnerability Dashboard          Week: 2026-W17      │
├──────────┬──────┬──────┬─────┬─────┬────────────────┤
│ Project  │ CRIT │ HIGH │ MED │ LOW │ Trend (8w)     │
├──────────┼──────┼──────┼─────┼─────┼────────────────┤
│ CTDC   → │   7  │  24  │  61 │  12 │ /\/\_          │
│ ICDC   → │   3  │  12  │  45 │   8 │ /\___/         │
│ PopSci → │   1  │   8  │  19 │   4 │ ___/\          │
│ GEN    → │   0  │   4  │  11 │   2 │ ____/          │
│ ...      │      │      │     │     │                │
└──────────┴──────┴──────┴─────┴─────┴────────────────┘
Sort by: [Critical ▼]   Filter: [● Has issues ▼]

 Drilldown
┌─────────────────────────────────────────────────────────────────────┐
│  ← Dashboard   /   ICDC                          Week: 2026-W17    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ CRITICAL │  │   HIGH   │  │  MEDIUM  │  │   LOW    │           │
│  │    3     │  │    12    │  │    45    │  │    8     │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│   (red bg)      (amber bg)    (blue bg)      (gray bg)             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Vulnerability Trend — 8 weeks                                      │
│                                                                     │
│  50 ┤                  ╭──╮                                         │
│  40 ┤        ╭─────────╯  ╰──╮   ── backend (critical)             │
│  30 ┤   ╭────╯               ╰──  ─ ─ frontend (critical)          │
│  20 ┤───╯                         ··· files (critical)             │
│  10 ┤                              ╌╌ interoperation (critical)     │
│     └──────────────────────────────                                 │
│     W10  W11  W12  W13  W14  W15  W16  W17                         │
│                                                                     │
│     Severity:  [● Critical]  [● High]  [○ Medium]  [○ Low]         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Vulnerabilities   Filter: [☑ Crit] [☑ High] [☐ Med] [☐ Low]      │
│                    Component: [All ▼]    Fix: [All ▼]              │
│                                                     Search: [    ] │
│                                                                     │
│  Component              │ CVE           │ Sev      │CVSS│ Package  │
│  ───────────────────────┼───────────────┼──────────┼────┼────────  │
│  crdc-icdc-backend      │ CVE-2024-3094 │ CRITICAL │9.8 │ xz-utils │
│  crdc-icdc-backend      │ CVE-2024-1234 │ CRITICAL │9.1 │ openssl  │
│  crdc-icdc-frontend     │ CVE-2025-0015 │ CRITICAL │8.9 │ libexpat │
│  crdc-icdc-backend      │ CVE-2024-5678 │ HIGH     │7.8 │ curl     │
│  crdc-icdc-files        │ CVE-2024-9012 │ HIGH     │7.2 │ zlib     │
│  crdc-icdc-interoperat  │ CVE-2024-3311 │ HIGH     │6.9 │ libc     │
│  ...                    │ ...           │ ...      │... │ ...      │
│                                                                     │
│  Showing 15 of 68 ·  ← Prev  [1] 2 3 4 5  Next →                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
 