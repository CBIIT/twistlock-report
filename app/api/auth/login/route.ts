import { TwistlockError, authenticate } from "@/lib/twistlock";
import { loginFormSchema } from "@/lib/validators";

export async function POST(request: Request): Promise<Response> {
	try {
		const body = await request.json();
		const parsed = loginFormSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json({ error: "Username and password are required." }, { status: 400 });
		}

		const { username, password } = parsed.data;
		const token = await authenticate(username, password);

		return Response.json({ token });
	} catch (error) {
		if (error instanceof TwistlockError) {
			return Response.json({ error: error.message }, { status: error.statusCode });
		}

		console.error("Unexpected error during authentication:", error);
		return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
	}
}
