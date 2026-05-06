"use client";

import { useRouter } from "next/navigation";
import ReportForm from "@/components/ReportForm";
import { useSessionAuth } from "@/lib/useSessionAuth";


export default function ReportPage() {
  const router = useRouter();
  const { token, isChecking, isAuthenticated } = useSessionAuth("/");

  function handleSessionExpired() {
    sessionStorage.removeItem("twistlockToken");
    router.push("/");
  }

  function handleLogout() {
    sessionStorage.removeItem("twistlockToken");
    router.push("/");
  }

  if (isChecking || !isAuthenticated || !token) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f8fafc_30%,#f8fafc_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col gap-6">
        <div>
          <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)]">
            <ReportForm token={token} onSessionExpired={handleSessionExpired} onLogout={handleLogout} />
          </section>
        </div>
      </div>
    </main>
  );
}
