import type { Metadata } from "next";
import "./globals.css";
import AppNavbar from "@/components/AppNavbar";

export const metadata: Metadata = {
  title: "Twistlock Portal",
  description: "Vulnerability dashboard, scan reports, and container security insights powered by Twistlock.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}
