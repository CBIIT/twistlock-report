#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { authenticate, getScanResult, resolveRegistry, TwistlockError } from "../lib/twistlock";
import { buildCombinedReport, type ImageScanEntry } from "../lib/report-builder";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

interface ComponentConfig {
	image: string;
	tag: string;
}

interface ProjectConfig {
	project: string;
	tpm?: string;
	components: ComponentConfig[];
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { projects: string[] | null } {
	const idx = process.argv.indexOf("--projects");
	if (idx === -1 || !process.argv[idx + 1]) return { projects: null };
	const projects = process.argv[idx + 1]
		.split(",")
		.map((p) => p.trim().toLowerCase())
		.filter(Boolean);
	return { projects: projects.length > 0 ? projects : null };
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function prompt(question: string, hidden = false): Promise<string> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		if (hidden) {
			// Suppress echoing for password input
			process.stdout.write(question);
			process.stdin.setRawMode?.(true);
			let input = "";
			process.stdin.resume();
			process.stdin.setEncoding("utf8");
			const onData = (ch: string) => {
				if (ch === "\n" || ch === "\r" || ch === "") {
					process.stdin.setRawMode?.(false);
					process.stdin.pause();
					process.stdin.removeListener("data", onData);
					process.stdout.write("\n");
					rl.close();
					resolve(input);
				} else if (ch === "") {
					input = input.slice(0, -1);
				} else {
					input += ch;
				}
			};
			process.stdin.on("data", onData);
		} else {
			rl.question(question, (answer) => {
				rl.close();
				resolve(answer.trim());
			});
		}
	});
}

async function getCredentials(): Promise<{ username: string; password: string }> {
	const username = process.env.TWISTLOCK_USERNAME?.trim();
	const password = process.env.TWISTLOCK_PASSWORD?.trim();

	if (username && password) {
		console.log(`Using credentials from environment (user: ${username})`);
		return { username, password };
	}

	console.log("Twistlock credentials not found in environment. Please enter them now.");
	const u = username || (await prompt("Username: "));
	const p = password || (await prompt("Password: ", true));
	return { username: u, password: p };
}

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

function makeOutputDir(): string {
	const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	const dir = path.join(process.cwd(), "reports", date);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

function sanitizeFilename(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ---------------------------------------------------------------------------
// Per-project report generation
// ---------------------------------------------------------------------------

async function generateProjectReport(
	project: ProjectConfig,
	token: string,
	outputDir: string
): Promise<void> {
	const date = new Date().toISOString().slice(0, 10);
	console.log(`\n[${project.project.toUpperCase()}] Starting (${project.components.length} components)`);

	const entries: ImageScanEntry[] = [];
	const skipped: string[] = [];

	for (const component of project.components) {
		const label = `${component.image}:${component.tag}`;
		try {
			process.stdout.write(`  Fetching ${label} ... `);
			const registry = await resolveRegistry(component.image, component.tag, token);
			const scanResult = await getScanResult(registry, component.image, component.tag, token);
			entries.push({ imageName: component.image, imageTag: component.tag, registry, scanResult });
			console.log("ok");
		} catch (err) {
			const msg = err instanceof TwistlockError ? err.message : String(err);
			console.log(`SKIPPED (${msg})`);
			skipped.push(label);
		}
	}

	if (entries.length === 0) {
		console.log(`  No scan data retrieved — skipping report for ${project.project}`);
		return;
	}

	if (skipped.length > 0) {
		console.log(`  Warning: skipped ${skipped.length} component(s): ${skipped.join(", ")}`);
	}

	const buffer = await buildCombinedReport({
		projectName: project.project,
		tpm: project.tpm,
		reportDate: new Date(),
		entries,
	});

	const filename = `${sanitizeFilename(project.project)}_CombinedScanReport_${date}.docx`;
	const outPath = path.join(outputDir, filename);
	fs.writeFileSync(outPath, buffer);
	console.log(`  Report saved: ${outPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { projects: filter } = parseArgs();

	const configPath = path.join(process.cwd(), "projects.config.json");
	if (!fs.existsSync(configPath)) {
		console.error("Error: projects.config.json not found in project root.");
		process.exit(1);
	}

	const allProjects: ProjectConfig[] = JSON.parse(fs.readFileSync(configPath, "utf8"));

	const projects = filter
		? allProjects.filter((p) => filter.includes(p.project.toLowerCase()))
		: allProjects;

	if (projects.length === 0) {
		console.error(
			filter
				? `No projects matched: ${filter.join(", ")}. Available: ${allProjects.map((p) => p.project).join(", ")}`
				: "projects.config.json is empty."
		);
		process.exit(1);
	}

	console.log(`Projects to process: ${projects.map((p) => p.project).join(", ")}`);

	const { username, password } = await getCredentials();

	let token: string;
	try {
		token = await authenticate(username, password);
		console.log("Authenticated successfully.");
	} catch (err) {
		const msg = err instanceof TwistlockError ? err.message : String(err);
		console.error(`Authentication failed: ${msg}`);
		process.exit(1);
	}

	const outputDir = makeOutputDir();
	console.log(`Output directory: ${outputDir}`);

	for (const project of projects) {
		await generateProjectReport(project, token, outputDir);
	}

	console.log("\nDone.");
}

main().catch((err) => {
	console.error("Unexpected error:", err);
	process.exit(1);
});
