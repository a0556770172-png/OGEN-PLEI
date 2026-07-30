"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { DEVELOPER_TERMS } from "@/lib/constants";

// שדרוג משתמש רגיל שכבר מחובר וממופה לחשבון מפתח - ישירות מתוך הפרופיל, בלי טופס הרשמה
// חדש (אין צורך במייל/סיסמה נוספים - המשתמש כבר מאומת בסשן הקיים שלו).
export const dynamic = "force-dynamic";

export default function BecomeDeveloperPage() {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(DEVELOPER_TERMS.map(() => false));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allChecked = checked.every(Boolean);

  async function handleAccept() {
    if (!allChecked) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/upgrade-to-developer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(json?.error || "שדרוג החשבון נכשל, נסה שוב");
      return;
    }
    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-gold shadow-glow">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-black">הרשמה כמפתח</h1>
          <p className="text-sm text-gray-400">יש לקרוא ולאשר את כל הסעיפים כדי לשדרג את החשבון שלך למפתח</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {DEVELOPER_TERMS.map((term, i) => (
            <label
              key={i}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface2 p-4 transition hover:border-primary/40"
            >
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => {
                  const next = [...checked];
                  next[i] = e.target.checked;
                  setChecked(next);
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-sm leading-relaxed text-gray-300">
                <b className="text-white">{i + 1}.</b> {term}
              </span>
            </label>
          ))}
        </div>

        <button onClick={handleAccept} disabled={!allChecked || loading} className="btn-primary mt-6 w-full">
          <CheckCircle2 className="h-4 w-4" />
          {loading ? "משדרג..." : "אני מאשר את כל התנאים והופך למפתח"}
        </button>
      </motion.div>
    </div>
  );
}
