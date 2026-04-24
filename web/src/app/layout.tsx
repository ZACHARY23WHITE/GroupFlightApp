import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppHeader } from "@/components/app-header";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Group trip planner",
  description:
    "Plan trips with people in different cities. Share a trip, add home airports, compare per-person fares into a destination.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-800 selection:bg-rose-100/80">
        <AuthProvider>
          <AppHeader />
          <div className="flex min-h-0 flex-1 flex-col pb-[calc(8.25rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
          <AppBottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
