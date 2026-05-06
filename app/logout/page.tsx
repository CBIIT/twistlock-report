"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    sessionStorage.removeItem("twistlockToken");
    router.replace("/");
  }, [router]);

  return null;
}
