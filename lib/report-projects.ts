import { query } from "@/lib/db";

export type ReportProject = {
	project: string;
	imageNames: string[];
};

type ReportProjectRow = {
	project: string;
	image_names: string[] | null;
};

type ProjectImageNameRow = {
	image_name: string;
};

export async function listReportProjects(): Promise<ReportProject[]> {
	const rows = await query<ReportProjectRow>(`
		SELECT
			pim.project,
			COALESCE(
				array_agg(DISTINCT COALESCE(itm.image_name, pim.image_name) ORDER BY COALESCE(itm.image_name, pim.image_name)),
				ARRAY[]::text[]
			) AS image_names
		FROM project_image_mapping pim
		LEFT JOIN image_tag_mapping itm
			ON itm.project_image_mapping_id = pim.id
		GROUP BY pim.project
		ORDER BY pim.project ASC
	`);

	return rows.map((row) => ({
		project: row.project,
		imageNames: row.image_names ?? [],
	}));
}

export async function listProjectImageNames(projectName: string): Promise<string[]> {
	const rows = await query<ProjectImageNameRow>(`
		SELECT DISTINCT image_name
		FROM project_image_mapping
		WHERE project = $1
		ORDER BY image_name ASC
	`, [projectName]);

	return rows.map((row) => row.image_name).filter((value) => value.trim().length > 0);
}
