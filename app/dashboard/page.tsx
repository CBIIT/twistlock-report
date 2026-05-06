"use client";

import PortfolioOverviewDesign from "./_components/PortfolioOverviewDesign";
import { useSessionAuth } from "@/lib/useSessionAuth";

export default function DesignPage() {
  const { isChecking, isAuthenticated } = useSessionAuth("/");

  if (isChecking || !isAuthenticated) {
    return null;
  }

  return <PortfolioOverviewDesign />;
}
