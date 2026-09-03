"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Gift, Send, Loader2, AlertCircle, CheckCircle2, FileArchive, Image as ImageIcon, ShieldAlert, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { putToR2 } from "@/lib/uploadHelpers";
import { MIN_ANDROID_VERSIONS } from "@/lib/androidVersions";
import { parseApkForForm } from "@/lib/apkManifest";
import RichTextEditor from "@/components/RichTextEditor";
import type { AppSuggestion, Category } from "@/types/database";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "ממתינה לבדיקה", cls: "bg-gold/15 text-gold" },
  approved: { label: "אושרה! +5 מוניטין", cls: "bg-accent/15 text-accent" },
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
  const [autoDetected, setAutoDetected] = useState<string[]>([]);
  const [note, setNote] = useState("");

  async function handleFilePick(f: File | null) {
    setFile(f);
    setAutoDetected([]);
    if (!f) return;
    const info = await parseApkForForm(f);
    const found: string[] = [];
    if (info.minSdkLabel) {
      setMinAndroidVersion(info.minSdkLabel);
      found.push(`גרסת אנדרואיד מינימלית: ${info.minSdkLabel}`);
    }
    if (info.versionName) {
      setVersion((v) => v || info.versionName!);
      found.push(`גרסה: ${info.versionName}`);
    }
    if (found.length) setAutoDetected(found);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<AppSuggestion[]>([]);
  // בדיוק כמו בהעלאה הפרטית (app/dashboard/developer/upload/page.tsx) - לפני שליחה בפועל
  // מציגים חלונית אישור עם שאלת הנטפרי ושאלת האופליין/אונליין, כדי שהתשובות יילקחו במודעות
  // וגם כדי לתת עוד רגע לוודא שהפרטים נכונים.
  const [showConfirm, setShowConfirm] = useState(false);
  const [netfreeAdapted, setNetfreeAdapted] = useState(false);
  const [offlineSupport, setOfflineSupport] = useState<"offline" | "online" | "unknown">("unknown");

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

  function openConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
    setShowConfirm(true);
  }

  async function handleSubmit() {
    // תיאורטית לא אמור לקרות (openConfirm כבר בדק), אבל שומר על TypeScript מרוצה ועל בטיחות
    // אם משום מה הקובץ התאפס בין הפתיחה של החלונית לאישור שלה.
    if (!file) {
      setError("יש להעלות את קובץ ההתקנה של האפליקציה/התוכנה");
      setShowConfirm(false);
      return;
    }
    setShowConfirm(false);
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
          category: netfreeAdapted ? "netfree" : category,
          iconKey: uploadedIconKey,
          developerName,
          fileKey: initJson.fileKey,
          fileName: file.name,
          fileSize: file.size,
          minAndroidVersion,
          offlineSupport
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
      setNetfreeAdapted(false);
      setOfflineSupport("unknown");
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
        <h1 className="text-3xl font-black">הוספה למאגר וצבירת מוניטין</h1>
        <p className="mx-auto mt-2 max-w-lg text-gray-400">
          מכירים אפליקציה או תוכנה פופולרית ומאושרת (כמו Waze, WhatsApp וכו') שכדאי שתהיה זמינה בחנות? הציעו אותה כאן.
          כשההצעה שלכם תאושר ותתפרסם, תקבלו 5 מוניטין. הגעה ל-300 מוניטין מזכה בשדרוג PRO אוטומטי.
        </p>
        <p className="mx-auto mt-3 max-w-lg text-xs text-gray-500">
          שימו לב: זו הצעה ציבורית - הצוות בודק ומפרסם אותה בעצמו, ואחרי הפרסום היא לא תהיה ניתנת לעריכה על ידכם (לא
          פרטים ולא גרסאות חדשות). אם אתם עצמכם המפתחים ורוצים לפרסם ולנהל אפליקציה משלכם עם אפשרות לערוך אותה בעתיד -
          <Link href="/signup/developer" className="mx-1 font-bold text-primary-light hover:underline">ההרשמה כמפתח</Link>
          היא המסלול המתאים.
        </p>
      </div>

      <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={openConfirm} className="card flex flex-col gap-4 p-6">
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
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
            className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[#fff]"
          />
          {autoDetected.length > 0 && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-accent">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>זוהה אוטומטית מהקובץ ומולא בטופס (ניתן לשנות): {autoDetected.join(" · ")}</span>
            </div>
          )}
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

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-gold" />
              <h2 className="text-lg font-bold text-white">רגע לפני שליחה - שתי שאלות אחרונות</h2>
            </div>

            <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-surface2 p-4 text-sm">
              <input
                type="checkbox"
                checked={netfreeAdapted}
                onChange={(e) => setNetfreeAdapted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-gray-300">
                האם האפליקציה מותאמת/מוכרת כתואמת לגלישה מסוננת בנטפרי?
                <span className="mt-1 block text-xs text-gray-500">
                  אם מסמנים כן - האפליקציה תפורסם (אחרי אישור הצוות) בקטגוריה הייעודית "מותאם נטפרי" במקום הקטגוריה
                  שנבחרה למעלה.
                </span>
              </span>
            </label>

            <div className="mb-5 rounded-xl border border-white/10 bg-surface2 p-4 text-sm">
              <p className="mb-2 text-gray-300">האם האפליקציה/התוכנה פועלת אופליין (בלי אינטרנט)?</p>
              <div className="flex flex-col gap-1.5">
                {([
                  ["offline", "כן, פועלת גם אופליין"],
                  ["online", "לא, חייבת חיבור אינטרנט"],
                  ["unknown", "לא ידוע"]
                ] as const).map(([val, label]) => (
                  <label key={val} className="flex cursor-pointer items-center gap-2 text-gray-300">
                    <input
                      type="radio"
                      name="offlineSupportSuggest"
                      checked={offlineSupport === val}
                      onChange={() => setOfflineSupport(val)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={handleSubmit} className="btn-primary flex-1">
                <Send className="h-4 w-4" /> כן, שליחת ההצעה
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white"
              >
                לא, אני רוצה לתקן
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
