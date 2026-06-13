import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppLogo } from "@/components/layout/AppLogo";
import { SiteNav } from "@/components/layout/SiteNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivicMirror — See your representatives clearly",
  description:
    "Nonpartisan civic engagement: find your officials, align on issues, and discuss with your district.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <AppLogo size="sm" />
            <SiteNav />
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
