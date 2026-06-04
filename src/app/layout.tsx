import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
            <Link href="/" className="font-semibold tracking-tight">
              CivicMirror
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/onboarding" className="text-slate-600 hover:text-slate-900 dark:text-slate-400">
                Onboarding
              </Link>
              <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 dark:text-slate-400">
                Dashboard
              </Link>
              <Link href="/auth" className="text-slate-600 hover:text-slate-900 dark:text-slate-400">
                Sign in
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
