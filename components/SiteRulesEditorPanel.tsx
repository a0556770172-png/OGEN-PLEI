"use client";
import { useEffect, useState } from "react";
import { Save, Megaphone, Loader2, AlertCircle, CheckCircle2, Eye } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import SiteRulesContent from "./SiteRulesContent";
import { DEFAULT_SITE_RULES_HTML } from "@/lib/siteRulesDefault";

// טאב "חוקי האתר" בניהול/פיקוח - עריכת התוכן (עם שימור עיצוב, ע"י אותו RichTextEditor
// שמשמש לתיאורי אפליקציות) ופרסום עדכון. "שמירה" בלבד לא מתריע לאף אחד - משמש לתיקוני
// נוסח שוטפים. "פרסום עדכון" זו פעולה חמורה יותר במכוון: היא מקפיצה מחדש את שער חוקי
// האתר (components/SiteRulesGate.tsx) לכל משתמש שכבר אישר בעבר, ושולחת לכולם התראת
// דחיפה - ולכן יש אישור כפול ואפשרות לכתוב הודעת הסבר/התנצלות שתוצג להם.
export default function SiteRulesEditorPanel({ isAdmin }: { isAdmin: boolean }) {
  const [html, setHtml] = useState(DEFAULT_SITE_RULES_HTML);
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [updateNote, setUpdateNote] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-rules")
      .then((r) => r.json())
      .then((json) => {
        setHtml(json.html && json.html.trim() ? json.html : DEFAULT_SITE_RULES_HTML);
        setVersion(json.version ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving("save");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/site-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, action: "save" })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בשמירה");
      setMessage("נשמר בהצלחה. השינוי לא הותרה לאף אחד - רק תוכן שיוצג מעכשיו.");
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setSaving(null);
    }
  }

  async function publish() {
    setSaving("publish");
    setError("");
    setMessage("");
    setShowPublishConfirm(false);
    try {
      const res = await fetch("/api/admin/site-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, action: "publish", updateNote })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בפרסום");
      setVersion(json.version ?? version + 1);
      setUpdateNote("");
      setMessage("העדכון פורסם! חוקי האתר יקפצו שוב לכל מי שכבר אישר בעבר, וכולם קיבלו התראה.");
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="card p-8 text-center text-gray-500">טוען...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <p className="text-sm text-gray-400">
          כאן אפשר לערוך את תוכן "חוקי האתר" (מוצג בשער החובה החד-פעמי ובעמוד <b className="text-white">/site-rules</b>).
          עריכה עם עיצוב עשיר (כותרות, רשימות, הדגשות) - בדיוק כמו בתיאור אפליקציה.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          <b className="text-gold">"שמירה"</b> שומרת את התוכן בלי להתריע לאף אחד - לתיקוני נוסח שוטפים.{" "}
          <b className="text-red-400">"פרסום עדכון + התראה לכולם"</b> היא פעולה חמורה: היא מקפיצה מחדש את חוקי האתר
          לכל מי שכבר אישר, ושולחת התראת דחיפה לכולם - יש להשתמש בזה רק בשינוי משמעותי, לא בכל תיקון קטן.
        </p>
        <p className="mt-2 text-xs text-gray-500">גרסה נוכחית: {version}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {message}
        </div>
      )}

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-white">תוכן החוקים</h3>
          <button onClick={() => setPreview((p) => !p)} className="btn-ghost text-xs">
            <Eye className="h-3.5 w-3.5" /> {preview ? "חזרה לעריכה" : "תצוגה מקדימה"}
          </button>
        </div>
        {preview ? (
          <div className="rounded-xl border border-white/10 bg-surface2 p-4">
            <SiteRulesContent html={html} />
          </div>
        ) : (
          <RichTextEditor value={html} onChange={setHtml} placeholder="חוקי האתר..." />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={saving !== null} className="btn-ghost">
          {saving === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמירה (בלי להתריע)
        </button>
        <button onClick={() => setShowPublishConfirm(true)} disabled={saving !== null} className="btn-primary">
          {saving === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          פרסום עדכון + התראה לכולם
        </button>
      </div>

      {showPublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6">
            <div className="mb-3 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-gold" />
              <h2 className="text-lg font-bold text-white">פרסום עדכון לכל המשתמשים</h2>
            </div>
            <p className="mb-4 text-sm text-gray-400">
              זה יקפיץ מחדש את חוקי האתר לכל מי שכבר אישר בעבר, וישלח לכולם התראה. אפשר (לא חובה) לכתוב כאן הודעת
              הסבר/התנצלות קצרה שתוצג להם יחד עם החוקים המעודכנים.
            </p>
            <textarea
              rows={3}
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              className="input-field mb-4 resize-none"
              placeholder='לדוגמה: "מצטערים על אי הנוחות - עדכנו את מכסת האפליקציות בחשבון רגיל ל-10, נא לקרוא שוב"'
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={publish} className="btn-primary flex-1">
                <Megaphone className="h-4 w-4" /> כן, פרסם והתרע לכולם
              </button>
              <button onClick={() => setShowPublishConfirm(false)} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
