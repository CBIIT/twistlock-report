import { listProjectImageNames } from "@/lib/report-projects";
import { TwistlockError, searchByImageNames } from "@/lib/twistlock";
import { z } from "zod";

const searchImagesSchema = z.object({
	projectName: z.string().min(1, "Project name is required"),
	twistlockToken: z.string().min(1, "Twistlock token is required"),
});

export async function POST(request: Request): Promise<Response> {
	try {
		const body = await request.json();
		const parsed = searchImagesSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json({ error: "Invalid input. Please check all fields." }, { status: 400 });
		}

		const { projectName, twistlockToken } = parsed.data;
		const imageNames = await listProjectImageNames(projectName);

		if (imageNames.length === 0) {
			return Response.json({ error: `No repositories found for project "${projectName}" in database.` }, { status: 404 });
		}

		const repositories = await searchByImageNames(imageNames, twistlockToken);

		return Response.json({ repositories });
	} catch (error) {
		if (error instanceof TwistlockError) {
			return Response.json({ error: error.message }, { status: error.statusCode });
		}

		console.error("Unexpected error during image search:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
