"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Sparkles,
  HardDrive,
  MessageCircle,
  Send,
  Mail,
  PartyPopper,
  ShieldAlert,
  Clock
} from "lucide-react";
import { REFERRAL } from "@/lib/constants";
import type { ReferralStats } from "@/types/database";

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof PartyPopper }
> = {
  rewarded: { label: "תוגמל", className: "bg-accent/15 text-accent", icon: PartyPopper },
  capped: { label: "מעבר לתקרה היומית", className: "bg-gold/15 text-gold", icon: Clock },
  blocked_ip: { label: "נחסם (אותה רשת)", className: "bg-red-500/15 text-red-400", icon: ShieldAlert },
  revoked: { label: "בוטל ע\"י הצוות", className: "bg-red-500/15 text-red-400", icon: ShieldAlert }
};

export default function ReferralCard({ username, stats }: { username: string; stats: ReferralStats }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const link = useMemo(
    () => `${origin || "https://ogen-plei-qype.vercel.app"}/?ref=${encodeURIComponent(username)}`,
    [origin, username]
  );

  const shareMessage = `הצטרפו לעוגן פליי — מאגר אפליקציות ותוכנות מאושרות ומסוננות. הרשמה דרך הקישור שלי:\n${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // דפדפן ישן - נבחר את הטקסט לפחות
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: "עוגן פליי", text: shareMessage, url: link });
    } catch {
      // המשתמש ביטל / לא נתמך
    }
  }

  const tiles = [
    { icon: Users, label: "חברים שהצטרפו", value: stats.totalJoined, tone: "text-primary-light" },
    { icon: Sparkles, label: "מוניטין שהרווחת", value: stats.pointsEarned, tone: "text-accent" },
    { icon: HardDrive, label: `קרדיטים של ${REFERRAL.sizeOverrideMb}MB זמינים`, value: stats.sizeCredits, tone: "text-gold" }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-surface to-surface p-6 shadow-glow sm:p-8"
    >
      {/* הילה מעוצבת ברקע */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">הזמינו חברים — וקבלו על זה</h2>
            <p className="text-sm text-gray-400">
              על כל חבר שנרשם דרך הקישור שלכם ומאמת מייל: <b className="text-accent">{REFERRAL.referrerPoints} מוניטין</b> +
              קרדיט להעלאת קובץ גדול (<b className="text-gold">{REFERRAL.sizeOverrideMb}MB</b>). גם החבר מקבל{" "}
              <b className="text-primary-light">{REFERRAL.joinerPoints} מוניטין</b> מתנה.
            </p>
          </div>
        </div>

        {/* הקישור האישי */}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-gray-500">הקישור האישי שלך</label>
          <div className="flex gap-2">
            <input
              readOnly
              dir="ltr"
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="input-field flex-1 !text-left font-mono text-sm"
            />
            <button
              onClick={copy}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                copied ? "bg-accent text-[#0b0b10]" : "bg-primary text-[#fff] hover:bg-primary-light"
              }`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "הועתק!" : "העתקה"}
            </button>
          </div>
        </div>

        {/* כפתורי שיתוף */}
        <div className="flex flex-wrap gap-2">
          {canNativeShare && (
            <button onClick={nativeShare} className="btn-primary text-sm">
              <Share2 className="h-4 w-4" /> שיתוף
            </button>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-sm"
          >
            <MessageCircle className="h-4 w-4 text-[#25D366]" /> וואטסאפ
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
              "הצטרפו לעוגן פליי דרך הקישור שלי:"
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-sm"
          >
            <Send className="h-4 w-4 text-[#2AABEE]" /> טלגרם
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("הצטרפו לעוגן פליי")}&body=${encodeURIComponent(shareMessage)}`}
            className="btn-ghost text-sm"
          >
            <Mail className="h-4 w-4" /> מייל
          </a>
        </div>

        {/* מוני נתונים */}
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface2/60 p-3 text-center">
              <t.icon className={`h-4 w-4 ${t.tone}`} />
              <span className="text-xl font-black text-white">{t.value}</span>
              <span className="text-[11px] leading-tight text-gray-500">{t.label}</span>
            </div>
          ))}
        </div>

        {/* רשימת מצטרפים אחרונים */}
        {stats.recent.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-gray-500">מצטרפים אחרונים</p>
            <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
              {stats.recent.map((r, i) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.rewarded;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 bg-surface2/40 px-3 py-2 text-sm">
                    <span className="truncate text-gray-300">{r.username ?? "משתמש"}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>
                      <meta.icon className="h-3 w-3" />
                      {r.status === "rewarded" ? `+${r.points}` : meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-gray-500">
          כדי לשמור על הוגנות: עד {REFERRAL.dailyRewardCap} הפניות מתוגמלות ביום, ואי אפשר לתגמל הרשמה מאותה
          רשת/מכשיר של המפנה. הפניה כזו עדיין נרשמת — פשוט בלי מוניטין. הצוות יכול לשחרר ידנית במקרים אמיתיים.
        </p>
      </div>
    </motion.div>
  );
}
