"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionAuth } from "@/lib/useSessionAuth";
import { useIamPermissions } from "@/lib/useIamPermissions";

type ComponentRecord = {
  id: number;
  project: string;
  imageName: string;
  currentTag: string;
  isProd: boolean;
  createdAt: string;
};

type ComponentForm = {
  project: string;
  imageName: string;
  currentTag: string;
  isProd: boolean;
};

type SortKey = "id" | "project" | "imageName" | "currentTag" | "createdAt";
type SortDirection = "asc" | "desc";
type ProdFilter = "all" | "prod" | "non-prod";

const emptyForm: ComponentForm = {
  project: "",
  imageName: "",
  currentTag: "",
  isProd: true,
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminPage() {
  const { isChecking, isAuthenticated } = useSessionAuth("/");
  const { canCreate, canUpdate, canDelete, isLoading: isIamLoading } = useIamPermissions("system_settings");
  const [rows, setRows] = useState<ComponentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const [newForm, setNewForm] = useState<ComponentForm>(emptyForm);
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ComponentForm>(emptyForm);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [projectFilter, setProjectFilter] = useState("all");
  const [prodFilter, setProdFilter] = useState<ProdFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const isBusy = isAdding || isSavingEdit || deletingId !== null;

  const loadComponents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/components", { method: "GET", cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to load components.");
      }

      const payload = (await response.json()) as { components: ComponentRecord[] };
      setRows(payload.components ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load components.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  useEffect(() => {
    if (!actionNotice) return;

    const timeoutId = window.setTimeout(() => {
      setActionNotice(null);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  const sortedRows = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      if (sortBy === "id") {
        return (a.id - b.id) * directionMultiplier;
      }

      if (sortBy === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * directionMultiplier;
      }

      return a[sortBy].localeCompare(b[sortBy]) * directionMultiplier;
    });
  }, [rows, sortBy, sortDirection]);

  const projectOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.project))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return sortedRows.filter((row) => {
      const projectMatch = projectFilter === "all" || row.project === projectFilter;
      if (!projectMatch) return false;

      const prodMatch =
        prodFilter === "all" ||
        (prodFilter === "prod" && row.isProd) ||
        (prodFilter === "non-prod" && !row.isProd);
      if (!prodMatch) return false;

      if (!query) return true;

      return (
        row.project.toLowerCase().includes(query) ||
        row.imageName.toLowerCase().includes(query) ||
        row.currentTag.toLowerCase().includes(query) ||
        String(row.id).includes(query)
      );
    });
  }, [prodFilter, projectFilter, searchText, sortedRows]);

  if (isChecking || !isAuthenticated) {
    return null;
  }

  const isReadOnly = !isIamLoading && !canCreate && !canUpdate && !canDelete;

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextKey);
    setSortDirection(nextKey === "id" || nextKey === "createdAt" ? "desc" : "asc");
  }

  function getSortLabel(key: SortKey) {
    if (sortBy !== key) {
      return "Sort";
    }

    return sortDirection === "asc" ? "Sorted ascending" : "Sorted descending";
  }

  function renderSortIcon(key: SortKey) {
    if (sortBy !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />;
    }

    if (sortDirection === "asc") {
      return <ArrowUp className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />;
    }

    return <ArrowDown className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />;
  }

  function beginEdit(row: ComponentRecord) {
    setActionNotice(null);
    setEditingId(row.id);
    setEditForm({
      project: row.project,
      imageName: row.imageName,
      currentTag: row.currentTag,
      isProd: row.isProd,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function handleAdd() {
    setActionNotice(null);

    try {
      setIsAdding(true);
      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to add component.");
      }

      const payload = (await response.json()) as { component: ComponentRecord };
      setRows((prev) => [payload.component, ...prev]);
      setNewForm(emptyForm);
      setActionNotice({
        tone: "success",
        message: `Added mapping ${payload.component.project} / ${payload.component.imageName}:${payload.component.currentTag} (${payload.component.isProd ? "Prod" : "Non-prod"}).`,
      });
    } catch (err) {
      setActionNotice({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to add component.",
      });
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSaveEdit(id: number) {
    setActionNotice(null);

    try {
      setIsSavingEdit(true);
      const response = await fetch(`/api/components/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update component.");
      }

      const payload = (await response.json()) as { component: ComponentRecord };
      setRows((prev) => prev.map((row) => (row.id === id ? payload.component : row)));
      cancelEdit();
      setActionNotice({
        tone: "success",
        message: `Updated mapping ${payload.component.project} / ${payload.component.imageName}:${payload.component.currentTag} (${payload.component.isProd ? "Prod" : "Non-prod"}).`,
      });
    } catch (err) {
      setActionNotice({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to update component.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(id: number) {
    setActionNotice(null);

    const targetRow = rows.find((row) => row.id === id);

    const confirmed = window.confirm(`Delete component #${id}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeletingId(id);
      const response = await fetch(`/api/components/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to delete component.");
      }

      setRows((prev) => prev.filter((row) => row.id !== id));
      if (editingId === id) {
        cancelEdit();
      }
      setActionNotice({
        tone: "success",
        message: targetRow
          ? `Deleted mapping ${targetRow.project} / ${targetRow.imageName}:${targetRow.currentTag}.`
          : `Deleted mapping #${id}.`,
      });
    } catch (err) {
      setActionNotice({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to delete component.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f8fafc_30%,#ffffff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">System Settings</h1>
            {isReadOnly ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                Read-only
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Manage production image/tag mappings. Data is backed by project/image and image/tag mapping tables.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-700">Project:</label>
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {projectOptions.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-700">Status:</label>
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                  value={prodFilter}
                  onChange={(e) => setProdFilter(e.target.value as ProdFilter)}
                >
                  <option value="all">All</option>
                  <option value="prod">Prod</option>
                  <option value="non-prod">Non-prod</option>
                </select>
              </div>
            </div>

            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by id, project, image name, or tag"
              className="w-full sm:max-w-md"
            />
          </div>

          {actionNotice ? (
            <p
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                actionNotice.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
              role="status"
              aria-live="polite"
            >
              {actionNotice.message}
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("id")}
                        aria-label={`Sort by ID. ${getSortLabel("id")}`}
                      >
                        <span>ID</span>
                        {renderSortIcon("id")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("project")}
                        aria-label={`Sort by project. ${getSortLabel("project")}`}
                      >
                        <span>Project</span>
                        {renderSortIcon("project")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("imageName")}
                        aria-label={`Sort by image name. ${getSortLabel("imageName")}`}
                      >
                        <span>Image Name</span>
                        {renderSortIcon("imageName")}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("currentTag")}
                        aria-label={`Sort by current tag. ${getSortLabel("currentTag")}`}
                      >
                        <span>Current Tag</span>
                        {renderSortIcon("currentTag")}
                      </button>
                    </th>
                    <th className="px-4 py-3">Prod Status</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs uppercase tracking-[0.12em] text-slate-600 hover:text-slate-900"
                        onClick={() => handleSort("createdAt")}
                        aria-label={`Sort by created at. ${getSortLabel("createdAt")}`}
                      >
                        <span>Created At</span>
                        {renderSortIcon("createdAt")}
                      </button>
                    </th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {canCreate ? (
                  <tr className="border-t border-slate-100 bg-sky-50/50 align-top">
                    <td className="px-4 py-3 text-slate-500">new</td>
                    <td className="px-4 py-3">
                      <Input
                        value={newForm.project}
                        onChange={(e) => setNewForm((prev) => ({ ...prev, project: e.target.value }))}
                        placeholder="e.g. ICDC"
                        disabled={isBusy}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={newForm.imageName}
                        onChange={(e) => setNewForm((prev) => ({ ...prev, imageName: e.target.value }))}
                        placeholder="e.g. crdc-icdc-backend"
                        disabled={isBusy}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={newForm.currentTag}
                        onChange={(e) => setNewForm((prev) => ({ ...prev, currentTag: e.target.value }))}
                        placeholder="e.g. prod-14.13.0.221"
                        disabled={isBusy}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                        value={newForm.isProd ? "prod" : "non-prod"}
                        onChange={(e) => setNewForm((prev) => ({ ...prev, isProd: e.target.value === "prod" }))}
                        disabled={isBusy}
                      >
                        <option value="prod">Prod</option>
                        <option value="non-prod">Non-prod</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-500">auto</td>
                    <td className="px-4 py-3">
                      <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={isBusy}>
                        {isAdding ? "Adding..." : "Add"}
                      </Button>
                    </td>
                  </tr>
                  ) : null}

                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading mappings...</td>
                    </tr>
                  ) : null}

                  {!isLoading && filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No mappings match the current filter/search.
                      </td>
                    </tr>
                  ) : null}

                  {filteredRows.map((row) => {
                    const isEditing = editingId === row.id;
                    const isDeletingThisRow = deletingId === row.id;

                    return (
                      <tr key={row.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.id}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              value={editForm.project}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, project: e.target.value }))}
                              disabled={isBusy}
                            />
                          ) : (
                            <span className="text-slate-900">{row.project}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              value={editForm.imageName}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, imageName: e.target.value }))}
                              disabled={isBusy}
                            />
                          ) : (
                            <span className="text-slate-900">{row.imageName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              value={editForm.currentTag}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, currentTag: e.target.value }))}
                              disabled={isBusy}
                            />
                          ) : (
                            <span className="text-slate-900">{row.currentTag}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                              value={editForm.isProd ? "prod" : "non-prod"}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, isProd: e.target.value === "prod" }))}
                              disabled={isBusy}
                            >
                              <option value="prod">Prod</option>
                              <option value="non-prod">Non-prod</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                                row.isProd
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                              }`}
                            >
                              {row.isProd ? "Prod" : "Non-prod"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatTimestamp(row.createdAt)}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleSaveEdit(row.id)}
                                disabled={isBusy}
                              >
                                {isSavingEdit ? "Saving..." : "Save"}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={isBusy}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {canUpdate ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => beginEdit(row)} disabled={isBusy}>
                                  Edit
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(row.id)}
                                  disabled={isBusy}
                                >
                                  {isDeletingThisRow ? "Deleting..." : "Delete"}
                                </Button>
                              ) : null}
                              {!canUpdate && !canDelete ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
