"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReportForm from "@/components/ReportForm";


export default function ReportPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("twistlockToken");
    if (saved) {
      setToken(saved);
    }
  }, []);

  function handleSessionExpired() {
    sessionStorage.removeItem("twistlockToken");
    setToken(null);
    router.push("/");
  }

  function handleLogout() {
    sessionStorage.removeItem("twistlockToken");
    setToken(null);
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f8fafc_30%,#f8fafc_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col gap-6">
        <div>
          <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)]">
            {token ? (
              <ReportForm token={token} onSessionExpired={handleSessionExpired} onLogout={handleLogout} />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Please sign in from the home page to access the report generator.</p>
                <Link
                  href="/"
                  className="inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Go to Login
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
