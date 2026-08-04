"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Send, Loader2, AlertCircle, CheckCircle2, FileArchive, Image as ImageIcon, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { putToR2 } from "@/lib/uploadHelpers";
import { MIN_ANDROID_VERSIONS } from "@/lib/androidVersions";
import RichTextEditor from "@/components/RichTextEditor";
import type { AppSuggestion, Category } from "@/types/database";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "ממתינה לבדיקה", cls: "bg-gold/15 text-gold" },
  approved: { label: "אושרה! +5 נק'", cls: "bg-accent/15 text-accent" },
  rejected: { label: "נדחתה", cls: "bg-red-500/15 text-red-400" }
};

export default function SuggestAppPage() {
  const supabase = createClient();
  const [appName, setAppName] = useState("");
  const [version, setVersion] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("general");
  const [developerName, setDeveloperName] = useState("");
  const [icon, setIcon] = useState<File | null>(null);
  // בכוונה בלי ברירת מחדל - חובה לבחור בעצמו את גרסת האנדרואיד המינימלית, כדי שלא תישלח
  // בטעות גרסה שגויה שרק "נשארה מסומנת" מברירת המחדל.
  const [minAndroidVersion, setMinAndroidVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<AppSuggestion[]>([]);

  async function loadMine() {
    const { data } = await supabase.from("app_suggestions").select("*").order("created_at", { ascending: false });
    setMySuggestions((data as AppSuggestion[]) ?? []);
  }

  useEffect(() => {
    loadMine();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((json) => {
        const list: Category[] = json.categories ?? [];
        setCategories(list);
        if (list.length && !list.some((c) => c.value === category)) setCategory(list[0].value);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("יש להעלות את קובץ ההתקנה של האפליקציה/התוכנה");
      return;
    }
    if (!minAndroidVersion) {
      setError("חובה לבחור גרסת אנדרואיד מינימלית נדרשת");
      return;
    }
    if (!developerName.trim()) {
      setError("חובה לציין את שם המפתח/חברת הפיתוח האמיתית של האפליקציה");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const initRes = await fetch("/api/suggestions/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "application/octet-stream",
          iconFileName: icon?.name,
          iconContentType: icon?.type
        })
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error || "שגיאה באתחול ההעלאה");

      await putToR2(initJson.uploadUrl, file);

      let uploadedIconKey: string | null = null;
      if (icon && initJson.iconUploadUrl) {
        try {
          await putToR2(initJson.iconUploadUrl, icon);
          uploadedIconKey = initJson.iconKey;
        } catch {
          // אייקון הוא תוספת "רכה" - אם ההעלאה שלו נכשלת, לא מאבדים בגללה את כל ההצעה
        }
      }

      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName,
          version,
          note,
          shortDescription,
          descriptionHtml,
          category,
          iconKey: uploadedIconKey,
          developerName,
          fileKey: initJson.fileKey,
          fileName: file.name,
          fileSize: file.size,
          minAndroidVersion
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "שגיאה בשליחת ההצעה - ודאו שאתם מחוברים לחשבון");

      setAppName("");
      setVersion("");
      setShortDescription("");
      setDescriptionHtml("");
      setDeveloperName("");
      setIcon(null);
      setMinAndroidVersion("");
      setFile(null);
      setNote("");
      setSuccess(true);
      await loadMine();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary shadow-glow">
          <Gift className="h-6 w-6 text-[#fff]" />
        </div>
        <h1 className="text-3xl font-black">הוספה למאגר וצבירת נקודות</h1>
        <p className="mx-auto mt-2 max-w-lg text-gray-400">
          מכירים אפליקציה או תוכנה פופולרית ומאושרת (כמו Waze, WhatsApp וכו') שכדאי שתהיה זמינה בחנות? הציעו אותה כאן.
          כשההצעה שלכם תאושר ותתפרסם, תקבלו 5 נקודות. הגעה ל-300 נקודות מזכה בשדרוג PRO אוטומטי.
        </p>
      </div>

      <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="card flex flex-col gap-4 p-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> ההצעה נשלחה! נבדוק אותה בקרוב.
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            חל איסור מוחלט להעלות אפליקציות/תוכנות פרטיות/בתשלום ששייכות למפתח או חברה אחרים בלי לציין את שמם במפורש בשדה
            "מפתח/חברת הפיתוח" למטה. יש להעלות רק אפליקציות חופשיות/פופולריות ומאושרות (כמו Waze, WhatsApp וכו') - קרדיט
            למפתח המקורי הוא שדה חובה בטופס.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">שם האפליקציה / התוכנה</label>
            <input required value={appName} onChange={(e) => setAppName(e.target.value)} className="input-field" placeholder="למשל: Waze" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">מספר גרסה</label>
            <input required value={version} onChange={(e) => setVersion(e.target.value)} className="input-field" placeholder="למשל: 5.2.1" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">
            מפתח / חברת הפיתוח האמיתית <span className="text-gold">(חובה - קרדיט למפתח המקורי)</span>
          </label>
          <input
            required
            value={developerName}
            onChange={(e) => setDeveloperName(e.target.value)}
            className="input-field"
            placeholder="למשל: Waze Mobile Ltd, או שם המפתח הפרטי"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">תיאור קצר (יוצג בכרטיס)</label>
          <input required maxLength={140} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="input-field" placeholder="עד 140 תווים" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">תיאור מלא (אופציונלי)</label>
          <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} placeholder="תארו את האפליקציה/התוכנה, יכולות, הוראות שימוש..." />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">קטגוריה</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">גרסת אנדרואיד מינימלית נדרשת <span className="text-gold">(חובה)</span></label>
          <select required value={minAndroidVersion} onChange={(e) => setMinAndroidVersion(e.target.value)} className="input-field">
            <option value="" disabled>בחרו גרסה...</option>
            {MIN_ANDROID_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><FileArchive className="h-4 w-4" /> קובץ ההתקנה (APK לאפליקציה, או קובץ ההתקנה של התוכנה)</label>
          <input
            required
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[#fff]"
          />
          <p className="mt-1.5 text-xs text-gray-500">יש להעלות בעצמכם את קובץ ההתקנה (עד 200MB) כדי שהצוות יוכל לבדוק ולפרסם אותו.</p>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><ImageIcon className="h-4 w-4" /> אייקון (אופציונלי)</label>
          <input type="file" accept="image/*" onChange={(e) => setIcon(e.target.files?.[0] ?? null)} className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[#fff]" />
          <p className="mt-1.5 text-xs text-gray-500">אם לא תעלו אייקון וקובץ ההתקנה הוא APK/APKS, ננסה לחלץ אותו אוטומטית מתוך הקובץ עצמו.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">הערה לצוות (אופציונלי)</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="input-field resize-none" placeholder="למה כדאי להוסיף אותה?" />
        </div>

        <button type="submit" disabled={busy || !file} className="btn-primary mt-2 w-full sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          שליחת ההצעה
        </button>
      </motion.form>

      {mySuggestions.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">ההצעות שלי</h2>
          {mySuggestions.map((s) => (
            <div key={s.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="font-bold text-white">{s.app_name}</p>
                {s.note && <p className="text-xs text-gray-500">{s.note}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_LABEL[s.status].cls}`}>
                {STATUS_LABEL[s.status].label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
