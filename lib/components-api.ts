import { query } from "@/lib/db";

export type ComponentRecord = {
	id: number;
	project: string;
	imageName: string;
	currentTag: string;
	isProd: boolean;
	createdAt: string;
};

type ComponentDbRow = {
	id: number | string;
	project: string;
	image_name: string;
	current_tag: string;
	is_prod: boolean | string | number;
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

function toBoolean(value: boolean | string | number): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	const normalized = value.trim().toLowerCase();
	return normalized === "true" || normalized === "t" || normalized === "1" || normalized === "yes";
}

function mapRow(row: ComponentDbRow): ComponentRecord {
	return {
		id: toNumber(row.id),
		project: row.project,
		imageName: row.image_name,
		currentTag: row.current_tag,
		isProd: toBoolean(row.is_prod),
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

type PgErrorLike = {
	code?: string;
	constraint?: string;
};

function isImageTagPrimaryKeyConflict(error: unknown): error is PgErrorLike {
	if (!error || typeof error !== "object") return false;
	const candidate = error as PgErrorLike;
	return candidate.code === "23505" && candidate.constraint === "image_tag_mapping_pkey";
}

async function syncImageTagMappingSequence(): Promise<void> {
	await query(`
		SELECT setval(
			pg_get_serial_sequence('public.image_tag_mapping', 'id'),
			COALESCE((SELECT MAX(id) FROM public.image_tag_mapping), 1),
			true
		)
	`);
}

async function createComponentRow(
	project: string,
	imageName: string,
	currentTag: string,
	isProd: boolean
): Promise<ComponentDbRow | undefined> {
	const rows = await query<ComponentDbRow>(`
		WITH mapping AS (
			INSERT INTO project_image_mapping (project, image_name)
			VALUES ($1, $2)
			ON CONFLICT (project, image_name)
			DO UPDATE SET project = EXCLUDED.project
			RETURNING id, project, image_name
		),
		demoted AS (
			UPDATE image_tag_mapping
			SET is_prod = false
			WHERE $4::boolean
				AND project_image_mapping_id = (SELECT id FROM mapping)
		),
		upserted AS (
			INSERT INTO image_tag_mapping (project_image_mapping_id, image_name, current_tag, is_prod)
			VALUES ((SELECT id FROM mapping), $2, $3, $4)
			ON CONFLICT (project_image_mapping_id, current_tag)
			DO UPDATE SET
				image_name = EXCLUDED.image_name,
				is_prod = EXCLUDED.is_prod
			RETURNING id, image_name, current_tag, is_prod, created_at
		)
		SELECT
			u.id,
			m.project,
			u.image_name,
			u.current_tag,
			u.is_prod,
			u.created_at
		FROM upserted u
		CROSS JOIN mapping m
	`, [project, imageName, currentTag, isProd]);

	return rows[0];
}

export async function listComponents(): Promise<ComponentRecord[]> {
	const rows = await query<ComponentDbRow>(`
		SELECT
			itm.id,
			pim.project,
			COALESCE(NULLIF(BTRIM(itm.image_name), ''), pim.image_name) AS image_name,
			itm.current_tag,
			itm.is_prod,
			itm.created_at
		FROM image_tag_mapping itm
		JOIN project_image_mapping pim ON pim.id = itm.project_image_mapping_id
		ORDER BY itm.created_at DESC, itm.id DESC
	`);

	return rows.map(mapRow);
}

export async function createComponent(input: {
	project: string;
	imageName: string;
	currentTag: string;
	isProd: boolean;
}): Promise<ComponentRecord> {
	const project = sanitizeText(input.project, "Project");
	const imageName = sanitizeText(input.imageName, "Image name");
	const currentTag = sanitizeText(input.currentTag, "Current tag");
	const isProd = Boolean(input.isProd);

	let row: ComponentDbRow | undefined;
	try {
		row = await createComponentRow(project, imageName, currentTag, isProd);
	} catch (error) {
		if (!isImageTagPrimaryKeyConflict(error)) {
			throw error;
		}

		await syncImageTagMappingSequence();
		row = await createComponentRow(project, imageName, currentTag, isProd);
	}

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
		isProd: boolean;
	}
): Promise<ComponentRecord> {
	if (!Number.isInteger(id) || id <= 0) {
		throw new ComponentsApiError("Invalid component id.", 400);
	}

	const project = sanitizeText(input.project, "Project");
	const imageName = sanitizeText(input.imageName, "Image name");
	const currentTag = sanitizeText(input.currentTag, "Current tag");
	const isProd = Boolean(input.isProd);

	const rows = await query<ComponentDbRow>(`
		WITH existing AS (
			SELECT itm.id
			FROM image_tag_mapping itm
			WHERE itm.id = $1
		),
		mapping AS (
			INSERT INTO project_image_mapping (project, image_name)
			SELECT $2, $3
			FROM existing
			ON CONFLICT (project, image_name)
			DO UPDATE SET project = EXCLUDED.project
			RETURNING id, project
		),
		demoted AS (
			UPDATE image_tag_mapping
			SET is_prod = false
			WHERE $5::boolean
				AND project_image_mapping_id = (SELECT id FROM mapping)
				AND id <> $1
		),
		updated AS (
			UPDATE image_tag_mapping itm
			SET project_image_mapping_id = (SELECT id FROM mapping),
				image_name = $3,
				current_tag = $4,
				is_prod = $5
			WHERE itm.id = $1
				AND EXISTS (SELECT 1 FROM existing)
			RETURNING itm.id, itm.image_name, itm.current_tag, itm.is_prod, itm.created_at
		)
		SELECT
			u.id,
			m.project,
			u.image_name,
			u.current_tag,
			u.is_prod,
			u.created_at
		FROM updated u
		CROSS JOIN mapping m
	`, [id, project, imageName, currentTag, isProd]);

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
		WITH target AS (
			SELECT itm.id, itm.project_image_mapping_id
			FROM image_tag_mapping itm
			WHERE itm.id = $1
		),
		removed_tags AS (
			DELETE FROM image_tag_mapping itm
			WHERE itm.project_image_mapping_id = (SELECT project_image_mapping_id FROM target)
			RETURNING itm.id
		),
		removed_mapping AS (
			DELETE FROM project_image_mapping pim
			WHERE pim.id = (SELECT project_image_mapping_id FROM target)
			RETURNING pim.id
		)
		SELECT id
		FROM target
	`, [id]);

	if (!rows[0]) {
		throw new ComponentsApiError(`Component with id ${id} not found.`, 404);
	}
}
