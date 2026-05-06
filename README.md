# Twistlock Report App

Next.js application for searching Twistlock or Prisma Cloud repositories by project name and generating a combined container scan report as a Word document.

## What the app does

The application supports this workflow:

1. Sign in with a Twistlock username and password.
2. Search repositories by project name.
3. Select one or more repositories and image tags.
4. Generate and download a combined `.docx` scan report.

The generated report includes project details, release details, and vulnerability findings pulled from the Twistlock API.

## Setup

```bash
pnpm install --ignore-workspace
cp .env.example .env
```

## Running the web app

```bash
pnpm dev
```

## Batch CLI — generate reports for all projects

Edit `projects.config.json` with the current production image tags, then run:

```bash
pnpm reports                              # all projects
pnpm reports -- --projects icdc           # one project
pnpm reports -- --projects icdc,cds       # subset
```

Reports are saved to `./reports/YYYY-MM-DD/`.

Credentials are read from `TWISTLOCK_USERNAME` and `TWISTLOCK_PASSWORD` in `.env`. If not set, the script prompts interactively.
