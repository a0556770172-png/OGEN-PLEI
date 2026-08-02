"use client";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Rocket, Gift, Download, Heart, Package, Users, Eye } from "lucide-react";
import Link from "next/link";

interface StatItem {
  icon: typeof Package;
  value: number;
  label: string;
  color: string;
}

function StatCard({ icon: Icon, value, label, color }: StatItem) {
  return (
    <div className="card flex flex-1 flex-col items-center gap-1.5 px-4 py-5 text-center">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-black text-white">{value.toLocaleString("he-IL")}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

export default function HomeHero({
  total,
  totalDownloads,
  totalUsers,
  totalVisits
}: {
  total: number;
  totalDownloads: number;
  totalUsers: number;
  totalVisits: number;
}) {
  const stats: StatItem[] = [
    { icon: Package, value: total, label: "אפליקציות ותוכנות", color: "bg-primary/15 text-primary-light" },
    { icon: Download, value: totalDownloads, label: "הורדות", color: "bg-accent/15 text-accent" },
    { icon: Users, value: totalUsers, label: "משתמשים רשומים", color: "bg-gold/15 text-gold" },
    { icon: Eye, value: totalVisits, label: "כניסות לאתר", color: "bg-primary/15 text-primary-light" }
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface/60 px-6 py-16 text-center sm:px-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto flex max-w-3xl flex-col items-center gap-6"
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

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup/developer" className="btn-primary min-w-[170px] justify-center">
            <Rocket className="h-4 w-4" /> הרשמה כמפתח
          </Link>
          <Link href="/suggest-app" className="btn-ghost min-w-[170px] justify-center">
            <Gift className="h-4 w-4" /> הוספה למאגר וצבירת נקודות
          </Link>
          <Link href="#apps" className="btn-ghost min-w-[170px] justify-center">
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
