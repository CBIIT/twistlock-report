import { query } from "@/lib/db";

export type IamPermissions = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

type IamRow = {
  role: string;
};

export async function getIamPermissions(
  username: string,
  service: string,
): Promise<IamPermissions> {
  const rows = await query<IamRow>(
    `SELECT role FROM iam WHERE LOWER(username) = LOWER($1) AND LOWER(service) = LOWER($2) LIMIT 1`,
    [username.trim(), service.trim()],
  );

  const role = rows[0]?.role ?? "";
  const roleLower = role.toLowerCase();

  return {
    canCreate: roleLower.includes("create"),
    canUpdate: roleLower.includes("update"),
    canDelete: roleLower.includes("delete"),
  };
}
