import { z } from "zod";
import { ComponentsApiError, deleteComponent, updateComponent } from "@/lib/components-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updatePayloadSchema = z.object({
	project: z.string().min(1),
	imageName: z.string().min(1),
	currentTag: z.string().min(1),
});

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
	try {
		const { id } = await context.params;
		const parsedId = Number.parseInt(id, 10);
		if (!Number.isInteger(parsedId) || parsedId <= 0) {
			return Response.json({ error: "Invalid component id." }, { status: 400 });
		}

		const body = await request.json();
		const parsed = updatePayloadSchema.safeParse(body);
		if (!parsed.success) {
			return Response.json({ error: "Invalid input. Project, image name, and current tag are required." }, { status: 400 });
		}

		const component = await updateComponent(parsedId, parsed.data);
		return Response.json({ component });
	} catch (error) {
		if (error instanceof ComponentsApiError) {
			return Response.json({ error: error.message }, { status: error.status });
		}

		console.error("Unexpected error updating component:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
	try {
		const { id } = await context.params;
		const parsedId = Number.parseInt(id, 10);
		if (!Number.isInteger(parsedId) || parsedId <= 0) {
			return Response.json({ error: "Invalid component id." }, { status: 400 });
		}

		await deleteComponent(parsedId);
		return new Response(null, { status: 204 });
	} catch (error) {
		if (error instanceof ComponentsApiError) {
			return Response.json({ error: error.message }, { status: error.status });
		}

		console.error("Unexpected error deleting component:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
