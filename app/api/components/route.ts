import { z } from "zod";
import { ComponentsApiError, createComponent, listComponents } from "@/lib/components-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const componentPayloadSchema = z.object({
	project: z.string().min(1),
	imageName: z.string().min(1),
	currentTag: z.string().min(1),
	isProd: z.boolean().optional().default(true),
});

export async function GET(): Promise<Response> {
	try {
		const components = await listComponents();
		return Response.json({ components });
	} catch (error) {
		if (error instanceof ComponentsApiError) {
			return Response.json({ error: error.message }, { status: error.status });
		}

		console.error("Unexpected error listing components:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}

export async function POST(request: Request): Promise<Response> {
	try {
		const body = await request.json();
		const parsed = componentPayloadSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json({ error: "Invalid input. Project, image name, and current tag are required. isProd must be true/false." }, { status: 400 });
		}

		const component = await createComponent(parsed.data);
		return Response.json({ component }, { status: 201 });
	} catch (error) {
		if (error instanceof ComponentsApiError) {
			return Response.json({ error: error.message }, { status: error.status });
		}

		console.error("Unexpected error creating component:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
