"use client";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Rocket, Gift, Download, Heart } from "lucide-react";
import Link from "next/link";

export default function HomeHero({ total, totalDownloads }: { total: number; totalDownloads: number }) {
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
        {totalDownloads > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="inline-flex items-center gap-2.5 rounded-2xl border border-accent/30 bg-gradient-to-l from-accent/15 to-primary/15 px-5 py-3 shadow-glow"
          >
            <Download className="h-5 w-5 text-accent" />
            <span className="text-lg font-black text-white">{totalDownloads.toLocaleString("he-IL")}</span>
            <span className="text-sm font-bold text-gray-300">הורדות של משתמשים באתר</span>
          </motion.div>
        )}
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

        <a
          href="https://ko-fi.com/aishivsheramlumad"
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="group mt-1 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-bold text-gold transition-all duration-300 hover:border-gold/60 hover:bg-gold/15 hover:shadow-[0_0_25px_rgba(234,179,8,0.25)]"
        >
          <Heart className="h-3.5 w-3.5 transition-transform group-hover:scale-110" /> תמכו בפרויקט
        </a>
      </motion.div>
    </section>
  );
}
