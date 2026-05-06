"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

type SessionAuthState = {
  token: string | null;
  isChecking: boolean;
  isAuthenticated: boolean;
};

export function useSessionAuth(redirectTo = "/"): SessionAuthState {
  const router = useRouter();

  const token = useSyncExternalStore(
    () => () => undefined,
    () => {
      if (typeof window === "undefined") {
        return null;
      }
      return sessionStorage.getItem("twistlockToken");
    },
    () => null
  );

  useEffect(() => {
    if (!token) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, token]);

  return {
    token,
    isChecking: false,
    isAuthenticated: Boolean(token),
  };
}