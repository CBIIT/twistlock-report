"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionAuth } from "@/lib/useSessionAuth";

type ProjectCard = {
  project: string;
  imageNames: string[];
};

export default function ReportPage() {
  const router = useRouter();
  const { token, isChecking, isAuthenticated } = useSessionAuth("/");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleLogout() {
    sessionStorage.removeItem("twistlockToken");
    sessionStorage.removeItem("twistlockUsername");
    router.push("/");
  }

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    let isMounted = true;

    async function loadProjects() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/report/projects", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          let message = "Failed to load project list.";
          try {
            const body = (await response.json()) as { error?: string };
            message = body.error ?? message;
          } catch {
            // Ignore JSON parsing errors and fallback to generic message.
          }

          if (isMounted) {
            setErrorMessage(message);
          }
          return;
        }

        const data = (await response.json()) as { projects: ProjectCard[] };
        if (isMounted) {
          setProjects(data.projects ?? []);
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Network error while loading projects.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, token]);

  if (isChecking || !isAuthenticated || !token) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f8fafc_30%,#f8fafc_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col gap-6">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Report Generator</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Select a Project</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Projects and related images are loaded from the database mapping tables.
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-900"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>

          {isLoading ? <p className="mt-6 text-sm text-slate-500">Loading projects...</p> : null}

          {errorMessage ? (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {!isLoading && !errorMessage ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((item) => (
                <article
                  key={item.project}
                  className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{item.project}</h2>
                    <p className="mt-1 text-xs text-slate-500">{item.imageNames.length} image(s)</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.imageNames.length > 0 ? (
                      item.imageNames.map((imageName) => (
                        <span
                          key={`${item.project}-${imageName}`}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                        >
                          {imageName}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No images found</span>
                    )}
                  </div>

                  <Link
                    href={`/report/generate?project=${encodeURIComponent(item.project)}`}
                    className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Generate Report
                  </Link>
                </article>
              ))}
            </div>
          ) : null}

          {!isLoading && !errorMessage && projects.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No projects found in database.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
