import { z } from "zod";
import {
	DashboardApiError,
	getDrilldownPayload,
	type FixStatus,
	type Severity,
} from "@/lib/dashboard-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const severityValues: Severity[] = ["critical", "high", "medium", "low"];
const fixStatusValues: FixStatus[] = ["fixed", "available", "none"];

const querySchema = z.object({
	week: z.string().optional(),
	severities: z.string().optional(),
	component: z.string().optional(),
	fixStatus: z.string().optional(),
	q: z.string().optional(),
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().optional(),
});

function parseSeverityFilter(value?: string): Severity[] | undefined {
	if (!value) return undefined;

	const parsed = value
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter((item): item is Severity => severityValues.includes(item as Severity));

	return parsed.length > 0 ? Array.from(new Set(parsed)) : undefined;
}

function parseFixStatus(value?: string): FixStatus | undefined {
	if (!value) return undefined;
	const normalized = value.trim().toLowerCase();
	return fixStatusValues.includes(normalized as FixStatus) ? (normalized as FixStatus) : undefined;
}

type RouteContext = {
	params: Promise<{ project: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
	try {
		const { project } = await context.params;
		const url = new URL(request.url);
		const parsed = querySchema.safeParse({
			week: url.searchParams.get("week") ?? undefined,
			severities: url.searchParams.get("severities") ?? undefined,
			component: url.searchParams.get("component") ?? undefined,
			fixStatus: url.searchParams.get("fixStatus") ?? undefined,
			q: url.searchParams.get("q") ?? undefined,
			page: url.searchParams.get("page") ?? undefined,
			pageSize: url.searchParams.get("pageSize") ?? undefined,
		});

		if (!parsed.success) {
			return Response.json({ error: "Invalid query parameters." }, { status: 400 });
		}

		const payload = await getDrilldownPayload({
			projectSlug: project,
			week: parsed.data.week,
			severities: parseSeverityFilter(parsed.data.severities),
			component: parsed.data.component,
			fixStatus: parseFixStatus(parsed.data.fixStatus),
			query: parsed.data.q,
			page: parsed.data.page,
			pageSize: parsed.data.pageSize,
		});

		return Response.json(payload);
	} catch (error) {
		if (error instanceof DashboardApiError) {
			return Response.json({ error: error.message }, { status: error.status });
		}

		console.error("Unexpected error loading dashboard drilldown:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
