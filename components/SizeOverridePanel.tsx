"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, HardDrive, X } from "lucide-react";
import type { Profile } from "@/types/database";

// טאב "הרשאות גודל" - מנהל בפועל וגם צוות פיקוח יכולים לתת למשתמש ספציפי הרשאה חד-פעמית
// להעלות אפליקציה/תוכנה אחת בגודל חריג (מעבר למכסה הרגילה - 30MB בחשבון רגיל, 100MB ב-PRO).
// צוות פיקוח מוגבל לתקרה של 1GB (1024MB) - מנהל בפועל ללא הגבלה (נאכף גם בשרת ב-
// app/api/admin/users/[id]/route.ts, זה כאן רק כדי לתת פידבק מיידי בטופס עצמו).
// ברגע שהמשתמש בפועל מנצל את זה (מעלה קובץ שחורג מהמכסה הרגילה שלו), ההרשאה מתבטלת
// אוטומטית לבד - ראו app/api/apps/finalize/route.ts, app/api/apps/upload-init/route.ts
// ו-app/api/suggestions/route.ts.
export default function SizeOverridePanel({ profiles, isAdmin = true }: { profiles: Profile[]; isAdmin?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const staffCapMb = 1024;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? profiles.filter((p) => p.username.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q))
      : profiles;
    return [...list].sort((a, b) => a.username.localeCompare(b.username, "he"));
  }, [profiles, query]);

  async function setOverride(id: string, username: string) {
    const input = window.prompt(
      `כמה מגה-בייט לאשר ל"${username}" להעלות בפעם הבאה (חד-פעמי בלבד)?\nלדוגמה: 300 או 500` +
        (isAdmin ? "" : `\n(צוות פיקוח מוגבל עד ${staffCapMb}MB - 1GB)`)
    );
    if (input === null) return;
    const mb = Number(input.trim());
    if (!Number.isFinite(mb) || mb <= 0) {
      alert("יש להזין מספר תקין");
      return;
    }
    if (!isAdmin && mb > staffCapMb) {
      alert(`צוות פיקוח יכול לאשר עד ${staffCapMb}MB (1GB) בלבד - מעל זה נדרש אישור מנהל בפועל`);
      return;
    }
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_size_override", sizeOverrideMb: Math.round(mb) })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה במתן ההרשאה");
    }
  }

  async function clearOverride(id: string, username: string) {
    const ok = window.confirm(`לבטל את הרשאת הגודל החריגה של "${username}"?`);
    if (!ok) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_size_override" })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בביטול ההרשאה");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <p className="text-sm text-gray-400">
          כאן ניתן לאשר למשתמש ספציפי להעלות <b className="text-white">אפליקציה או תוכנה אחת בלבד</b> בגודל חריג
          (מעבר למכסה הרגילה שלו - 30MB בחשבון רגיל, 100MB בחשבון PRO, או 200MB בהצעת אפליקציה
          ציבורית). ברגע שהמשתמש בפועל מעלה קובץ שחורג מהמכסה הרגילה שלו - בין אם בהעלאה
          פרטית מהדשבורד ובין אם בהצעת אפליקציה ציבורית - ההרשאה מתבטלת אוטומטית ולא ניתן
          לנצל אותה שוב בלי אישור חדש. אם הוא מעלה בינתיים קובץ בתוך המכסה הרגילה, ההרשאה
          נשארת שמורה.
        </p>
        {!isAdmin && (
          <p className="mt-2 text-sm font-bold text-gold">כצוות פיקוח, אתה יכול לאשר עד 1024MB (1GB) בלבד - מעל זה נדרש אישור מנהל בפועל.</p>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש משתמש לפי שם או אימייל..."
          className="input w-full pe-10"
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-gray-500">
              <th className="px-4 py-3">משתמש</th>
              <th className="px-4 py-3">תוכנית</th>
              <th className="px-4 py-3">הרשאת גודל פעילה</th>
              <th className="px-4 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-surface2/50">
                <td className="px-4 py-3">
                  <div className="font-bold text-white">{p.username}</div>
                  <div className="text-xs text-gray-500">{p.email}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{p.is_pro ? "PRO (100MB)" : "רגיל (30MB)"}</td>
                <td className="px-4 py-3">
                  {p.size_override_mb ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold">
                      <HardDrive className="h-3 w-3" /> עד {p.size_override_mb}MB (חד-פעמי)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">אין</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {busyId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button onClick={() => setOverride(p.id, p.username)} className="btn-ghost text-xs">
                        <HardDrive className="h-3.5 w-3.5" /> {p.size_override_mb ? "עדכון" : "מתן הרשאה"}
                      </button>
                      {p.size_override_mb && (
                        <button onClick={() => clearOverride(p.id, p.username)} title="ביטול ההרשאה" className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">לא נמצאו משתמשים</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
