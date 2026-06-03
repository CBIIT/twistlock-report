import type { RegistrySearchItem, ProjectSearchResult, TwistlockScanResult } from "../types/twistlock";

const DEFAULT_BASE_URL = "https://twistlock.nci.nih.gov";

function getBaseUrl(): string {
	return process.env.TWISTLOCK_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function buildSearchParam(imageName: string, imageTag: string): string {
	const encoded = encodeURIComponent(`${imageName}:${imageTag}`);
	// Twistlock search syntax expects escaped dots and a doubly encoded separator.
	return encoded.replace(/\./g, "%5C.").replace(/%3A/g, "%253A");
}

function authHeader(token: string): HeadersInit {
	return { Authorization: `Bearer ${token}` };
}

export class TwistlockError extends Error {
	statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.statusCode = statusCode;
		this.name = "TwistlockError";
	}
}

export async function authenticate(
	username: string,
	password: string
): Promise<string> {
	const url = `${getBaseUrl()}/api/v1/authenticate`;

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});

	if (res.status === 401) {
		throw new TwistlockError(401, "Invalid username or password.");
	}
	if (!res.ok) {
		throw new TwistlockError(res.status, `Authentication failed: HTTP ${res.status}`);
	}

	const data = (await res.json()) as { token?: string };
	if (!data.token) {
		throw new TwistlockError(500, "Authentication succeeded but no token was returned.");
	}

	return data.token;
}

export async function resolveRegistry(
	imageName: string,
	imageTag: string,
	token: string
): Promise<string> {
	const search = buildSearchParam(imageName, imageTag);
	const url =
		`${getBaseUrl()}/api/v1/registry` +
		"?collections=CRDC+CCDI+All+Collection&compact=true&offset=0" +
		`&project=Central+Console&reverse=true&search=${search}&sort=vulnerabilityRiskScore`;

	console.log(`Resolving registry from Twistlock API ${url}`);
	const res = await fetch(url, { headers: authHeader(token) });

	if (res.status === 401) {
		throw new TwistlockError(401, "Authentication failed. Check your Twistlock token.");
	}
	if (!res.ok) {
		throw new TwistlockError(res.status, `Registry lookup failed: HTTP ${res.status}`);
	}

	const data = (await res.json()) as RegistrySearchItem[];
	const match = data.find(
		(item) => item.repoTag?.repo === imageName && item.repoTag?.tag === imageTag
	);

	if (!match) {
		throw new TwistlockError(404, `No scan record found for ${imageName}:${imageTag}.`);
	}

	return match.repoTag.registry;
}

export async function getScanResult(
	registry: string,
	imageName: string,
	imageTag: string,
	token: string
): Promise<TwistlockScanResult> {
	// const url =
	// 	`${getBaseUrl()}/api/v34.03/registry` +
	// 	`?registry=${encodeURIComponent(registry)}` +
	// 	`&repository=${encodeURIComponent(imageName)}` +
	// 	`&tag=${encodeURIComponent(imageTag)}&sort=scanTime`;

	const url =
		`${getBaseUrl()}/api/v34.03/registry` +
		`?registry=${encodeURIComponent(registry)}` +
		`&search=${encodeURIComponent(imageName)}:${encodeURIComponent(imageTag)}`;


	console.log(`Fetching scan result from Twistlock from API ${url}`);
	const res = await fetch(url, { headers: authHeader(token) });

	if (res.status === 401) {
		throw new TwistlockError(401, "Authentication failed. Check your Twistlock token.");
	}
	if (!res.ok) {
		throw new TwistlockError(res.status, `Scan result fetch failed: HTTP ${res.status}`);
	}

	const data = (await res.json()) as TwistlockScanResult[];
	if (!data || data.length === 0) {
		throw new TwistlockError(404, "No scan data available for this image.");
	}

	const match = data.find(
		(item) => item.repoTag?.repo === imageName && item.repoTag?.tag === imageTag
	);

	if (!match) {
		throw new TwistlockError(404, `No scan data found for ${imageName}:${imageTag}.`);
	}

	return match;
}

const MAX_TAGS_PER_REPO = 100;

async function searchTagsByImageName(imageName: string, token: string): Promise<ProjectSearchResult> {
	const search = encodeURIComponent(imageName);
	const url =
		`${getBaseUrl()}/api/v1/registry` +
		"?collections=CRDC+CCDI+All+Collection&compact=true&offset=0" +
		`&project=Central+Console&search=${search}&sort=scanTime&limit=250`;

	console.log(`Searching Twistlock tags for image "${imageName}" with API ${url}`);

	const res = await fetch(url, { headers: authHeader(token) });

	if (res.status === 401) {
		throw new TwistlockError(401, "Authentication failed. Check your Twistlock token.");
	}
	if (!res.ok) {
		throw new TwistlockError(res.status, `Registry search failed for image ${imageName}: HTTP ${res.status}`);
	}

	const data = (await res.json()) as RegistrySearchItem[];

	// De-duplicate tags and keep the latest scanTime per tag.
	const tagMap = new Map<string, { tag: string; creationTime: string; scanTime: string }>();
	for (const item of data ?? []) {
		const repo = item.repoTag?.repo;
		const tag = item.repoTag?.tag;
		if (!repo || !tag || repo !== imageName) {
			continue;
		}

		const scanTime = item.scanTime ?? "";
		const creationTime = item.creationTime ?? "";
		const current = tagMap.get(tag);
		if (!current || new Date(scanTime).getTime() > new Date(current.scanTime).getTime()) {
			tagMap.set(tag, { tag, creationTime, scanTime });
		}
	}

	const tags = [...tagMap.values()]
		.sort((a, b) => new Date(b.scanTime).getTime() - new Date(a.scanTime).getTime())
		.slice(0, MAX_TAGS_PER_REPO)
		.map((entry) => ({
			tag: entry.tag,
			creationTime: entry.creationTime,
			scanTime: entry.scanTime,
		}));

	return {
		repo: imageName,
		tags,
	};
}

export async function searchByImageNames(
	imageNames: string[],
	token: string
): Promise<ProjectSearchResult[]> {
	const uniqueImages = [...new Set(imageNames.map((name) => name.trim()).filter((name) => name.length > 0))];
	if (uniqueImages.length === 0) {
		return [];
	}

	const results = await Promise.all(uniqueImages.map((imageName) => searchTagsByImageName(imageName, token)));

	return results.sort((a, b) => a.repo.localeCompare(b.repo));
}
