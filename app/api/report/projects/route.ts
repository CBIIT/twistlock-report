import { listReportProjects } from "@/lib/report-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	try {
		const projects = await listReportProjects();
		return Response.json({ projects });
	} catch (error) {
		console.error("Unexpected error listing report projects:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
