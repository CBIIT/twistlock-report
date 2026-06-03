import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentsApiError, createComponentByImageName } from "@/lib/components-api";
import { POST } from "@/app/api/components/by-image/route";

vi.mock("@/lib/components-api", async () => {
	const actual = await vi.importActual<typeof import("@/lib/components-api")>("@/lib/components-api");

	return {
		...actual,
		createComponentByImageName: vi.fn(),
	};
});

describe("POST /api/components/by-image", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 201 when payload is valid", async () => {
		vi.mocked(createComponentByImageName).mockResolvedValue({
			id: 10,
			project: "demo-project",
			imageName: "nginx",
			currentTag: "1.27.0",
			isProd: true,
			createdAt: "2026-04-29T15:29:42.381Z",
		});

		const request = new Request("http://localhost/api/components/by-image", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				imageName: "nginx",
				currentTag: "1.27.0",
				isProd: true,
			}),
		});

		const response = await POST(request);
		const payload = await response.json();

		expect(response.status).toBe(201);
		expect(createComponentByImageName).toHaveBeenCalledWith({
			imageName: "nginx",
			currentTag: "1.27.0",
			isProd: true,
		});
		expect(payload).toEqual({
			component: {
				id: 10,
				project: "demo-project",
				imageName: "nginx",
				currentTag: "1.27.0",
				isProd: true,
				createdAt: "2026-04-29T15:29:42.381Z",
			},
		});
	});

	it("returns 400 when payload is invalid", async () => {
		const request = new Request("http://localhost/api/components/by-image", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ imageName: "", currentTag: "" }),
		});

		const response = await POST(request);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(createComponentByImageName).not.toHaveBeenCalled();
		expect(payload).toEqual({
			error: "Invalid input. imageName and currentTag are required. isProd must be true/false.",
		});
	});

	it("returns mapped ComponentsApiError status", async () => {
		vi.mocked(createComponentByImageName).mockRejectedValue(
			new ComponentsApiError("No record found for imageName 'nginx'.", 404)
		);

		const request = new Request("http://localhost/api/components/by-image", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ imageName: "nginx", currentTag: "1.27.0" }),
		});

		const response = await POST(request);
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload).toEqual({
			error: "No record found for imageName 'nginx'.",
		});
	});

	it("returns 500 on unexpected errors", async () => {
		vi.mocked(createComponentByImageName).mockRejectedValue(new Error("boom"));
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const request = new Request("http://localhost/api/components/by-image", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ imageName: "nginx", currentTag: "1.27.0" }),
		});

		const response = await POST(request);
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(payload).toEqual({ error: "An unexpected error occurred." });
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
