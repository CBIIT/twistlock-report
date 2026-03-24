import { TwistlockError, searchByProject } from "@/lib/twistlock";
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

		const repositories = await searchByProject(projectName, twistlockToken);

		return Response.json({ repositories });
	} catch (error) {
		if (error instanceof TwistlockError) {
			return Response.json({ error: error.message }, { status: error.statusCode });
		}

		console.error("Unexpected error during image search:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
