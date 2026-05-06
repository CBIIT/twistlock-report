import { query } from "@/lib/db";

export type ComponentRecord = {
	id: number;
	project: string;
	imageName: string;
	currentTag: string;
	createdAt: string;
};

type ComponentDbRow = {
	id: number | string;
	project: string;
	image_name: string;
	current_tag: string;
	created_at: string | Date;
};

export class ComponentsApiError extends Error {
	status: number;

	constructor(message: string, status = 500) {
		super(message);
		this.status = status;
	}
}

function toNumber(value: number | string): number {
	return typeof value === "number" ? value : Number.parseInt(value, 10);
}

function toIsoString(value: string | Date): string {
	if (value instanceof Date) return value.toISOString();
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function mapRow(row: ComponentDbRow): ComponentRecord {
	return {
		id: toNumber(row.id),
		project: row.project,
		imageName: row.image_name,
		currentTag: row.current_tag,
		createdAt: toIsoString(row.created_at),
	};
}

function sanitizeText(value: string, field: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new ComponentsApiError(`${field} is required.`, 400);
	}
	return trimmed;
}

export async function listComponents(): Promise<ComponentRecord[]> {
	const rows = await query<ComponentDbRow>(`
		SELECT id, project, image_name, current_tag, created_at
		FROM components
		ORDER BY id DESC
	`);

	return rows.map(mapRow);
}

export async function createComponent(input: {
	project: string;
	imageName: string;
	currentTag: string;
}): Promise<ComponentRecord> {
	const project = sanitizeText(input.project, "Project");
	const imageName = sanitizeText(input.imageName, "Image name");
	const currentTag = sanitizeText(input.currentTag, "Current tag");

	const rows = await query<ComponentDbRow>(`
		INSERT INTO components (project, image_name, current_tag)
		VALUES ($1, $2, $3)
		RETURNING id, project, image_name, current_tag, created_at
	`, [project, imageName, currentTag]);

	const row = rows[0];
	if (!row) {
		throw new ComponentsApiError("Failed to create component.");
	}

	return mapRow(row);
}

export async function updateComponent(
	id: number,
	input: {
		project: string;
		imageName: string;
		currentTag: string;
	}
): Promise<ComponentRecord> {
	if (!Number.isInteger(id) || id <= 0) {
		throw new ComponentsApiError("Invalid component id.", 400);
	}

	const project = sanitizeText(input.project, "Project");
	const imageName = sanitizeText(input.imageName, "Image name");
	const currentTag = sanitizeText(input.currentTag, "Current tag");

	const rows = await query<ComponentDbRow>(`
		UPDATE components
		SET project = $2,
			image_name = $3,
			current_tag = $4
		WHERE id = $1
		RETURNING id, project, image_name, current_tag, created_at
	`, [id, project, imageName, currentTag]);

	const row = rows[0];
	if (!row) {
		throw new ComponentsApiError(`Component with id ${id} not found.`, 404);
	}

	return mapRow(row);
}

export async function deleteComponent(id: number): Promise<void> {
	if (!Number.isInteger(id) || id <= 0) {
		throw new ComponentsApiError("Invalid component id.", 400);
	}

	const rows = await query<{ id: number | string }>(`
		DELETE FROM components
		WHERE id = $1
		RETURNING id
	`, [id]);

	if (!rows[0]) {
		throw new ComponentsApiError(`Component with id ${id} not found.`, 404);
	}
}
