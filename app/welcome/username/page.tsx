"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AtSign, AlertCircle, Loader2, UserRound } from "lucide-react";

// מונע רינדור סטטי בזמן ה-build (ראו הסבר מפורט ב-app/login/page.tsx)
export const dynamic = "force-dynamic";

// מסך בחירת שם משתמש - מוצג פעם אחת, מיד אחרי הרשמה עם Google (ראו app/auth/callback/route.ts
// ו-app/api/profile/username/route.ts). השדה ממולא מראש בשם שנוצר אוטומטית מהמייל.
export default function ChooseUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile/username")
      .then((r) => r.json())
      .then((json) => {
        if (!json.canChoose) {
          router.replace("/");
          return;
        }
        setUsername(json.username ?? "");
        setReady(true);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/profile/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "שגיאה בשמירת שם המשתמש");
      setSaving(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
            <UserRound className="h-6 w-6 text-[#fff]" />
          </div>
          <h1 className="text-2xl font-black">ברוך הבא לעוגן פליי!</h1>
          <p className="text-sm text-gray-400">בחר את שם המשתמש שיוצג באתר. אפשר להשאיר את השם המוצע.</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={save} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">שם משתמש</label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                dir="rtl"
                required
                minLength={3}
                maxLength={30}
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field pl-10"
                placeholder="השם שיוצג באתר"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">3-30 תווים. שים לב: לא ניתן לשנות את שם המשתמש בהמשך.</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary mt-2 w-full">
            {saving ? "שומר..." : "המשך"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
