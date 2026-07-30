import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import ModeratorAgreementGate from "@/components/ModeratorAgreementGate";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["300","400","500","700","900"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "עוגן פליי — חנות האפליקציות והתוכנות",
  description: "עוגן פליי — חנות אפליקציות ותוכנות מחשב מאובטחת ומוקפדת. הורידו, פרסמו, וגלו אפליקציות ותוכנות איכותיות."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body className={`${heebo.variable} font-sans bg-bg text-gray-100 min-h-screen antialiased relative`}>
        <AnimatedBackground />
        <ModeratorAgreementGate />
        <Navbar />
        <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="relative z-10 border-t border-border/60 py-8 text-center text-sm text-gray-500">
          כל הזכויות שמורות © עוגן פליי {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
