export interface RepoTag {
	registry: string;
	repo: string;
	tag: string;
}

export interface RegistrySearchItem {
	repoTag: RepoTag;
}

export interface Vulnerability {
	cve: string;
	severity: "critical" | "high" | "medium" | "low";
	cvss: number;
	status: string;
	packageName: string;
	packageVersion: string;
	description: string;
	link: string;
	discovered: string;
}

export interface TwistlockScanResult {
	_id: string;
	scanTime: string;
	distro: string;
	vulnerabilities: Vulnerability[] | null;
	vulnerabilitiesCount: number;
	repoTag: RepoTag;
}
