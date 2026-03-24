"use client";

import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import ReportForm from "@/components/ReportForm";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | undefined>();

  function handleSessionExpired() {
    setToken(null);
    setExpiredMessage("Your session has expired. Please log in again.");
  }

  function handleLogin(newToken: string) {
    setToken(newToken);
    setExpiredMessage(undefined);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-2xl font-semibold">Container Scan Report Generator</h1>
        {token ? (
          <ReportForm token={token} onSessionExpired={handleSessionExpired} onLogout={() => setToken(null)} />
        ) : (
          <LoginForm onLogin={handleLogin} expiredMessage={expiredMessage} />
        )}
      </div>
    </main>
  );
}
