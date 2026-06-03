import { z } from "zod";
import { ComponentsApiError, createComponentByImageName } from "@/lib/components-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const componentPayloadSchema = z.object({
	imageName: z.string().min(1),
	currentTag: z.string().min(1),
	isProd: z.boolean().optional().default(true),
});

export async function POST(request: Request): Promise<Response> {
	try {
		const body = await request.json();
		const parsed = componentPayloadSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{ error: "Invalid input. imageName and currentTag are required. isProd must be true/false." },
				{ status: 400 }
			);
		}

		const component = await createComponentByImageName(parsed.data);
		return Response.json({ component }, { status: 201 });
	} catch (error) {
		if (error instanceof ComponentsApiError) {
			return Response.json({ error: error.message }, { status: error.status });
		}

		console.error("Unexpected error creating component by imageName:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
