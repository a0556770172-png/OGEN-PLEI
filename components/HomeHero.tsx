"use client";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Rocket, Gift, Download, Heart, Package, Users, Eye, Star, Lightbulb } from "lucide-react";
import Link from "next/link";
import CountUp from "./CountUp";

interface StatItem {
  icon: typeof Package;
  value: number;
  label: string;
  color: string;
}

function StatCard({ icon: Icon, value, label, color, delay }: StatItem & { delay: number }) {
  return (
    <div className="card flex flex-1 flex-col items-center gap-1.5 px-4 py-5 text-center">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-black text-white">
        <CountUp value={value} delay={delay} />
      </p>
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
          <Sparkles className="h-3.5 w-3.5" /> <CountUp value={total} delay={0} /> אפליקציות ותוכנות בחנות
        </span>
        <h1 className="text-4xl font-black leading-tight sm:text-5xl">
          חנות האפליקציות והתוכנות
          <br />
          <span className="text-gradient whitespace-nowrap">עוגן פליי</span>
        </h1>
        <p className="max-w-xl text-lg text-gray-400">
          כל אפליקציה ותוכנה עוברת בדיקה ידנית ומוקפדת לפני פרסום. הורידו בביטחון, פרסמו בקלות.
        </p>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard key={s.label} {...s} delay={120 + i * 140} />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup/developer" className="btn-primary min-w-[170px] justify-center">
            <Rocket className="h-4 w-4" /> הרשמה כמפתח
          </Link>
          <Link href="/suggest-app" className="btn-ghost min-w-[170px] justify-center">
            <Gift className="h-4 w-4" /> הוספה למאגר וצבירת מוניטין
          </Link>
          <Link href="#apps" className="btn-ghost min-w-[170px] justify-center">
            <ShieldCheck className="h-4 w-4" /> עיון בחנות
          </Link>
        </div>
        <p className="max-w-xl text-center text-xs text-gray-500">
          "הרשמה כמפתח" - להעלאת אפליקציות/תוכנות שלך באופן פרטי, עם אפשרות לערוך פרטים ולהעלות גרסאות חדשות בכל עת.{" "}
          "הוספה למאגר" - להצעת אפליקציה/תוכנה קיימת (לא שלך) לצוות, כדי שיבדוק ויפרסם אותה בעצמו - זה לא ניתן לעריכה
          אח"כ, וזה מזכה במוניטין.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://ko-fi.com/aishivsheramlumad"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="group inline-flex items-center gap-2 rounded-full border-2 border-gold/50 bg-gold/15 px-5 py-2 text-sm font-bold text-gold shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-all duration-300 hover:border-gold/80 hover:bg-gold/25 hover:shadow-[0_0_30px_rgba(234,179,8,0.35)]"
          >
            <Heart className="h-4 w-4 transition-transform group-hover:scale-110" /> תמכו בפרויקט
          </a>
          <Link
            href="/site-reviews"
            className="group inline-flex items-center gap-2 rounded-full border-2 border-gold/50 bg-gold/15 px-5 py-2 text-sm font-bold text-gold shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-all duration-300 hover:border-gold/80 hover:bg-gold/25 hover:shadow-[0_0_30px_rgba(234,179,8,0.35)]"
          >
            <Star className="h-4 w-4 transition-transform group-hover:scale-110" /> דרגו והשפיעו
          </Link>
          <Link
            href="/forum"
            className="group inline-flex items-center gap-2 rounded-full border-2 border-gold/50 bg-gold/15 px-5 py-2 text-sm font-bold text-gold shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-all duration-300 hover:border-gold/80 hover:bg-gold/25 hover:shadow-[0_0_30px_rgba(234,179,8,0.35)]"
          >
            <Lightbulb className="h-4 w-4 transition-transform group-hover:scale-110" /> הצעות לשיפור ורעיונות
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
