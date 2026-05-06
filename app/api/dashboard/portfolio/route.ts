import { z } from "zod";
import { DashboardApiError, getPortfolioPayload, type SortKey } from "@/lib/dashboard-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
	week: z.string().optional(),
	sortBy: z.enum(["project", "critical", "high", "medium", "low"]).optional(),
	hasIssuesOnly: z
		.enum(["true", "false", "1", "0"])
		.optional()
		.transform((value) => {
			if (value === undefined) return undefined;
			return value === "true" || value === "1";
		}),
});

export async function GET(request: Request): Promise<Response> {
	try {
		const url = new URL(request.url);
		const parsed = querySchema.safeParse({
			week: url.searchParams.get("week") ?? undefined,
			sortBy: url.searchParams.get("sortBy") ?? undefined,
			hasIssuesOnly: url.searchParams.get("hasIssuesOnly") ?? undefined,
		});

		if (!parsed.success) {
			return Response.json({ error: "Invalid query parameters." }, { status: 400 });
		}

		const payload = await getPortfolioPayload({
			week: parsed.data.week,
			sortBy: parsed.data.sortBy as SortKey | undefined,
			hasIssuesOnly: parsed.data.hasIssuesOnly,
		});

		return Response.json(payload);
	} catch (error) {
		if (error instanceof DashboardApiError) {
			return Response.json({ error: error.message }, { status: error.status });
		}

		console.error("Unexpected error loading dashboard portfolio:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
