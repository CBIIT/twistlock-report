import { buildReport, buildCombinedReport } from "@/lib/report-builder";
import type { ImageScanEntry } from "@/lib/report-builder";
import { TwistlockError, getScanResult, resolveRegistry } from "@/lib/twistlock";
import { reportFormSchema, batchReportFormSchema } from "@/lib/validators";

function formatDateCompact(date: Date): string {
	return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function sanitizeFilenamePart(value: string): string {
	return value
		.trim()
		.replace(/\s+/g, "_")
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
		.replace(/_+/g, "_");
}

function buildFilename(projectName: string, imageName: string, imageTag: string, date: Date): string {
	const safeProject = sanitizeFilenamePart(projectName) || "Project";
	const safeImage = sanitizeFilenamePart(imageName) || "Image";
	const safeTag = sanitizeFilenamePart(imageTag) || "Tag";
	return `${safeProject}_${safeImage}_${safeTag}_ScanReport_${formatDateCompact(date)}.docx`;
}

function buildBatchFilename(projectName: string, count: number, date: Date): string {
	const safeProject = sanitizeFilenamePart(projectName) || "Project";
	return `${safeProject}_CombinedScanReport_${count}repos_${formatDateCompact(date)}.docx`;
}

export async function POST(request: Request): Promise<Response> {
	try {
		const body = await request.json();

		// Try batch schema first, fall back to single-image schema
		const batchParsed = batchReportFormSchema.safeParse(body);
		if (batchParsed.success) {
			return handleBatchReport(batchParsed.data);
		}

		const singleParsed = reportFormSchema.safeParse(body);
		if (singleParsed.success) {
			return handleSingleReport(singleParsed.data);
		}

		return Response.json({ error: "Invalid input. Please check all fields." }, { status: 400 });
	} catch (error) {
		if (error instanceof TwistlockError) {
			return Response.json({ error: error.message }, { status: error.statusCode });
		}

		console.error("Unexpected error while generating report:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}

async function handleSingleReport(data: {
	projectName?: string;
	tpm?: string;
	microserviceName: string;
	imageName: string;
	imageTag: string;
	twistlockToken: string;
}): Promise<Response> {
	const { projectName, tpm, microserviceName, imageName, imageTag, twistlockToken } = data;

	const registry = await resolveRegistry(imageName, imageTag, twistlockToken);
	const scanResult = await getScanResult(registry, imageName, imageTag, twistlockToken);

	const now = new Date();
	const reportBuffer = await buildReport({
		projectName,
		tpm,
		microserviceName,
		imageName,
		imageTag,
		reportDate: now,
		registry,
		scanResult,
	});

	const filename = buildFilename(projectName ?? "", imageName, imageTag, now);
	const responseBody = new Uint8Array(reportBuffer);

	return new Response(responseBody, {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
}

async function handleBatchReport(data: {
	projectName?: string;
	tpm?: string;
	selections: { imageName: string; imageTag: string }[];
	twistlockToken: string;
}): Promise<Response> {
	const { projectName, tpm, selections, twistlockToken } = data;

	const entries: ImageScanEntry[] = [];
	for (const sel of selections) {
		const registry = await resolveRegistry(sel.imageName, sel.imageTag, twistlockToken);
		const scanResult = await getScanResult(registry, sel.imageName, sel.imageTag, twistlockToken);
		entries.push({
			imageName: sel.imageName,
			imageTag: sel.imageTag,
			registry,
			scanResult,
		});
	}

	const now = new Date();
	const reportBuffer = await buildCombinedReport({
		projectName,
		tpm,
		reportDate: now,
		entries,
	});

	const filename = buildBatchFilename(projectName ?? "", selections.length, now);
	const responseBody = new Uint8Array(reportBuffer);

	return new Response(responseBody, {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
}
