import { z } from "zod";
import { getIamPermissions } from "@/lib/iam-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  username: z.string().min(1),
  service: z.string().min(1),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      username: url.searchParams.get("username") ?? "",
      service: url.searchParams.get("service") ?? "",
    });

    if (!parsed.success) {
      return Response.json({ error: "username and service are required." }, { status: 400 });
    }

    const permissions = await getIamPermissions(parsed.data.username, parsed.data.service);
    return Response.json(permissions);
  } catch (error) {
    console.error("Unexpected error loading IAM permissions:", error);
    return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
