"use client";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Rocket, Gift } from "lucide-react";
import Link from "next/link";

export default function HomeHero({ total }: { total: number }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface/60 px-6 py-16 text-center sm:px-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto flex max-w-2xl flex-col items-center gap-5"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary-light">
          <Sparkles className="h-3.5 w-3.5" /> {total.toLocaleString("he-IL")} אפליקציות ותוכנות בחנות
        </span>
        <h1 className="text-4xl font-black leading-tight sm:text-5xl">
          חנות האפליקציות והתוכנות <span className="text-gradient">עוגן פליי</span>
        </h1>
        <p className="max-w-xl text-lg text-gray-400">
          כל אפליקציה ותוכנה עוברת בדיקה ידנית ומוקפדת לפני פרסום. הורידו בביטחון, פרסמו בקלות.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup/developer" className="btn-primary">
            <Rocket className="h-4 w-4" /> הרשמה כמפתח
          </Link>
          <Link href="/suggest-app" className="btn-ghost">
            <Gift className="h-4 w-4" /> הוספה למאגר וצבירת נקודות
          </Link>
          <Link href="#apps" className="btn-ghost">
            <ShieldCheck className="h-4 w-4" /> עיון בחנות
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
