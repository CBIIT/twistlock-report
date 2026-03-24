"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import StatusBanner from "@/components/StatusBanner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { searchFormSchema, type SearchFormValues } from "@/lib/validators";
import type { ProjectSearchResult } from "@/types/twistlock";

type StatusState = {
	type: "success" | "error" | "info";
	message: string;
};

type RepoSelection = {
	repo: string;
	availableTags: string[];
	selectedTag: string;
	checked: boolean;
};

export default function ReportForm() {
	const [phase, setPhase] = useState<"search" | "select">("search");
	const [repos, setRepos] = useState<RepoSelection[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [status, setStatus] = useState<StatusState | null>(null);

	const form = useForm<SearchFormValues>({
		resolver: zodResolver(searchFormSchema),
		defaultValues: {
			projectName: "",
			tpm: "",
			twistlockToken: "",
		},
	});

	const checkedCount = repos.filter((r) => r.checked).length;
	const allChecked = repos.length > 0 && repos.every((r) => r.checked);

	async function onSearch(values: SearchFormValues): Promise<void> {
		setIsSearching(true);
		setStatus(null);

		try {
			const response = await fetch("/api/search-images", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectName: values.projectName,
					twistlockToken: values.twistlockToken,
				}),
			});

			if (!response.ok) {
				let message = "An unexpected error occurred.";
				try {
					const body = (await response.json()) as { error?: string };
					message = body.error ?? message;
				} catch {
					// ignore JSON parse errors
				}
				setStatus({ type: "error", message });
				return;
			}

			const data = (await response.json()) as { repositories: ProjectSearchResult[] };
			const selections: RepoSelection[] = data.repositories.map((r) => ({
				repo: r.repo,
				availableTags: r.tags.map((t) => t.tag),
				selectedTag: r.tags[0]?.tag ?? "",
				checked: true,
			}));

			setRepos(selections);
			setPhase("select");
			setStatus({
				type: "info",
				message: `Found ${selections.length} repositories for "${values.projectName.toUpperCase()}".`,
			});
		} catch {
			setStatus({ type: "error", message: "Network error while searching repositories." });
		} finally {
			setIsSearching(false);
		}
	}

	function toggleRepo(index: number) {
		setRepos((prev) =>
			prev.map((r, i) => (i === index ? { ...r, checked: !r.checked } : r))
		);
	}

	function toggleAll() {
		const newChecked = !allChecked;
		setRepos((prev) => prev.map((r) => ({ ...r, checked: newChecked })));
	}

	function changeTag(index: number, tag: string) {
		setRepos((prev) =>
			prev.map((r, i) => (i === index ? { ...r, selectedTag: tag } : r))
		);
	}

	function goBack() {
		setPhase("search");
		setStatus(null);
	}

	async function onGenerate(): Promise<void> {
		const selected = repos.filter((r) => r.checked);
		if (selected.length === 0) return;

		setIsGenerating(true);
		setStatus(null);

		const formValues = form.getValues();

		try {
			const response = await fetch("/api/generate-report", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectName: formValues.projectName,
					tpm: formValues.tpm,
					selections: selected.map((s) => ({
						imageName: s.repo,
						imageTag: s.selectedTag,
					})),
					twistlockToken: formValues.twistlockToken,
				}),
			});

			if (!response.ok) {
				let message = "An unexpected error occurred.";
				try {
					const body = (await response.json()) as { error?: string };
					message = body.error ?? message;
				} catch {
					// ignore JSON parse errors
				}
				setStatus({ type: "error", message });
				return;
			}

			const blob = await response.blob();
			const disposition = response.headers.get("Content-Disposition") ?? "";
			const filename =
				disposition.split("filename=")[1]?.replace(/"/g, "") ?? "CombinedScanReport.docx";
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.click();
			URL.revokeObjectURL(url);

			setStatus({
				type: "success",
				message: `Report generated with ${selected.length} repositor${selected.length > 1 ? "ies" : "y"}: ${selected.map((s) => `${s.repo}:${s.selectedTag}`).join(", ")}`,
			});
		} catch {
			setStatus({ type: "error", message: "Network error while generating report." });
		} finally {
			setIsGenerating(false);
		}
	}

	return (
		<div className="space-y-4">
			{status ? (
				<StatusBanner
					type={status.type}
					message={status.message}
					onDismiss={() => setStatus(null)}
				/>
			) : null}

			{phase === "search" && (
				<>
					<p className="text-sm text-gray-500">
						Enter a project name to discover repositories and generate scan reports.
					</p>

					<Form {...form}>
						<form className="space-y-4" onSubmit={form.handleSubmit(onSearch)} noValidate>
							<FormField
								control={form.control}
								name="projectName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Project Name</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g. C3DC, CCDI, ICDC"
												disabled={isSearching}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="tpm"
								render={({ field }) => (
									<FormItem>
										<FormLabel>TPM (optional)</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g. John Doe"
												disabled={isSearching}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="twistlockToken"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Twistlock Token</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="Paste your Twistlock Bearer token"
												disabled={isSearching}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<Button type="submit" className="w-full" disabled={isSearching}>
								{isSearching ? "Searching…" : "Search Repositories"}
							</Button>
						</form>
					</Form>
				</>
			)}

			{phase === "select" && (
				<>
					<button
						type="button"
						className="text-xs text-gray-500 hover:text-gray-900"
						onClick={goBack}
					>
						← Back to Search
					</button>

					<p className="text-xs text-gray-500">
						{checkedCount} of {repos.length} repositories selected
					</p>

					<div className="overflow-hidden rounded-xl border border-gray-200">
						<div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
							<span className="text-xs font-medium text-gray-500">Repository</span>
							<button
								type="button"
								className="text-xs font-medium text-blue-600 hover:underline"
								onClick={toggleAll}
							>
								{allChecked ? "Deselect All" : "Select All"}
							</button>
						</div>

						<div>
							{repos.map((repo, index) => (
								<div
									key={repo.repo}
									className={`flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50 transition-opacity ${
										repo.checked ? "" : "opacity-50"
									}`}
								>
									<input
										type="checkbox"
										className="h-4 w-4 accent-gray-900"
										checked={repo.checked}
										onChange={() => toggleRepo(index)}
										disabled={isGenerating}
									/>
									<span className="flex-1 font-mono text-sm font-medium">
										{repo.repo}
									</span>
									<select
										className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
										value={repo.selectedTag}
										onChange={(e) => changeTag(index, e.target.value)}
										disabled={isGenerating}
									>
										{repo.availableTags.map((tag) => (
											<option key={tag} value={tag}>
												{tag}
											</option>
										))}
									</select>
								</div>
							))}
						</div>
					</div>

					<Button
						className="w-full"
						disabled={checkedCount === 0 || isGenerating}
						onClick={onGenerate}
					>
						{isGenerating
							? "Generating…"
							: checkedCount > 0
								? `Generate Reports (${checkedCount})`
								: "Generate Reports"}
					</Button>
				</>
			)}
		</div>
	);
}
