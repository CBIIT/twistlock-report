"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AppNavbarProps = {
  className?: string;
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/docs", label: "User Guide" },
  { href: "/report", label: "Report Generator" },
  { href: "/system_settings", label: "System Settings" },
];

export default function AppNavbar({ className }: AppNavbarProps) {
  const pathname = usePathname();

  if (pathname === "/") return null;

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header
      className={cn(
        "w-full border-b border-slate-200 bg-white",
        className
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8"
      >
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white">TL</span>
          <span className="text-base font-semibold tracking-tight text-slate-900">Twistlock Portal</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "text-sky-600 border-b-2 border-sky-600"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Logout CTA */}
        <Link
          href="/logout"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Logout
        </Link>
      </nav>
    </header>
  );
}
