import { TwistlockError, searchByProject } from "@/lib/twistlock";
import { searchFormSchema } from "@/lib/validators";

export async function POST(request: Request): Promise<Response> {
	try {
		const body = await request.json();
		const parsed = searchFormSchema.safeParse(body);

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
