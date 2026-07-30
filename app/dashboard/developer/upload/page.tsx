"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UploadCloud, Loader2, AlertCircle, CheckCircle2, FileArchive, Image as ImageIcon, Sparkles } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { putToR2, extractIconFailureReason } from "@/lib/uploadHelpers";
import type { Category } from "@/types/database";

// מונע רינדור סטטי בזמן ה-build (ראו הסבר מפורט ב-app/login/page.tsx)
export const dynamic = "force-dynamic";

export default function UploadAppPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [version, setVersion] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting-icon" | "needs-icon" | "done">("idle");

  // אחרי שהאפליקציה כבר נשמרה בהצלחה (ונשלחה לבדיקה) אבל בלי אייקון - שומרים את המזהה שלה
  // כדי לאפשר להשלים אייקון בשלב נפרד, בלי לבנות מחדש את כל שאר הטופס.
  const [pendingAppId, setPendingAppId] = useState<string | null>(null);
  const [followUpIcon, setFollowUpIcon] = useState<File | null>(null);
  const [savingIcon, setSavingIcon] = useState(false);

  useEffect(() => {
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
    setError("");
    if (!file) { setError("יש לבחור קובץ להעלאה"); return; }

    setStatus("uploading");
    try {
      const initRes = await fetch("/api/apps/upload-init", {
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

      // מעלים קודם את קובץ האפליקציה עצמו — זה הקריטי. אם זה נכשל, עוצרים כאן.
      await putToR2(initJson.uploadUrl, file);

      // האייקון עדיין תוספת "רכה" בשלב הזה: אם ההעלאה הידנית שלו נכשלת (למשל דלי
      // ה-assets שכחו להגדיר לו CORS), לא רוצים לאבד את קובץ האפליקציה הגדול שכבר
      // עלה בהצלחה — ממשיכים בלי אייקון, ואז נבקש מהמפתח להשלים אייקון בשלב הבא.
      let iconUploadFailed = false;
      let uploadedIconKey: string | null = null;
      if (icon && initJson.iconUploadUrl) {
        try {
          await putToR2(initJson.iconUploadUrl, icon);
          uploadedIconKey = initJson.iconKey;
        } catch {
          iconUploadFailed = true;
        }
      } else if (file.name.toLowerCase().endsWith(".apk") || file.name.toLowerCase().endsWith(".apks")) {
        // לא הועלה אייקון ידנית — ננסה לחלץ אוטומטית מתוך קובץ ה-APK/APKS עצמו.
        setStatus("extracting-icon");
        try {
          const extractRes = await fetch("/api/apps/extract-icon", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKey: initJson.fileKey })
          });
          const extractJson = await extractRes.json().catch(() => null);
          if (extractRes.ok && extractJson?.iconKey) {
            uploadedIconKey = extractJson.iconKey;
          }
        } catch {
          // מתעלמים בכוונה — ננסה שוב ידנית בשלב הבא אם באמת אין אייקון
        }
        setStatus("uploading");
      }

      const finalizeRes = await fetch("/api/apps/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          shortDescription,
          descriptionHtml,
          version,
          category,
          fileKey: initJson.fileKey,
          fileName: file.name,
          fileSize: file.size,
          iconKey: uploadedIconKey
        })
      });
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeJson.error || "שגיאה בשמירה");

      // האפליקציה כבר נשמרה ונשלחה לבדיקה בכל מקרה (גם אם אין אייקון) - זה לא תלוי
      // באייקון. ההבדל היחיד הוא איך מודיעים למפתח: אם אין אייקון, לא מציגים "בוצע
      // בהצלחה" סתמי אלא דורשים ממנו להשלים תמונה (לאו דווקא האייקון הרשמי) עכשיו.
      if (uploadedIconKey) {
        setStatus("done");
        if (iconUploadFailed) {
          setError("שימו לב: העלאת האייקון שבחרתם נכשלה, אך האפליקציה נשלחה בהצלחה לבדיקה.");
        }
        setTimeout(() => router.push("/profile"), iconUploadFailed ? 3000 : 1200);
      } else {
        setPendingAppId(finalizeJson.app.id);
        setStatus("needs-icon");
      }
    } catch (err: any) {
      setStatus("idle");
      setError(err.message || "שגיאה כללית");
    }
  }

  async function saveFollowUpIcon() {
    if (!pendingAppId || !followUpIcon) return;
    setSavingIcon(true);
    setError("");
    try {
      const patchRes = await fetch(`/api/apps/${pendingAppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iconFileName: followUpIcon.name, iconContentType: followUpIcon.type })
      });
      const patchJson = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchJson.error || "שגיאה בשמירת האייקון");
      await putToR2(patchJson.iconUploadUrl, followUpIcon);

      setStatus("done");
      setTimeout(() => router.push("/profile"), 1200);
    } catch (err: any) {
      setError(err.message || "שגיאה בשמירת האייקון");
    } finally {
      setSavingIcon(false);
    }
  }

  function skipIconForNow() {
    // האפליקציה כבר נשלחה לבדיקה כרגיל - רק מסמנים לעצמנו (ולצוות הבדיקה) שאין לה
    // אייקון, כדי שהמנהל יוכל להזכיר למפתח להוסיף אחד מאוחר יותר.
    setStatus("done");
    setTimeout(() => router.push("/profile"), 1200);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
            <UploadCloud className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-black">העלאת אפליקציה / תוכנה</h1>
          <p className="text-sm text-gray-400">האפליקציה או התוכנה תישלח לבדיקה ידנית לפני פרסום בחנות</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {status === "done" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> ההעלאה בוצעה בהצלחה וממתינה לבדיקה!
          </div>
        )}

        {status === "needs-icon" && pendingAppId ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm text-gold">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" /> חסר קובץ אייקון לפרסום
              </div>
              <p className="text-gray-300">
                האפליקציה כבר נשלחה לבדיקה, אבל לא הצלחנו למצוא לה אייקון (לא הועלה ידנית, וגם לא הצלחנו לחלץ אחד
                אוטומטית מתוך הקובץ). כדי שהיא תתפרסם בצורה מסודרת, נא להעלות תמונה עכשיו.
              </p>
              <div className="flex items-start gap-1.5 text-xs text-gray-400">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-light" />
                <span>לא חייבת להיות דווקא האייקון הרשמי של האפליקציה - אפשר גם תמונה שנוצרה ב-AI, העיקר שהיא תשקף את מטרת האפליקציה.</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><ImageIcon className="h-4 w-4" /> קובץ אייקון</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFollowUpIcon(e.target.files?.[0] ?? null)}
                className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={saveFollowUpIcon} disabled={!followUpIcon || savingIcon} className="btn-primary flex-1">
                {savingIcon ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                שמירת האייקון
              </button>
              <button onClick={skipIconForNow} disabled={savingIcon} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white">
                אמשיך בלי אייקון כרגע (אפשר להוסיף בהמשך מהפרופיל)
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">שם האפליקציה / התוכנה</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="שם האפליקציה או התוכנה" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">תיאור קצר (יוצג בכרטיס)</label>
              <input required maxLength={140} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="input-field" placeholder="עד 140 תווים" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">תיאור מלא</label>
              <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} placeholder="תארו את האפליקציה/התוכנה, יכולות, הוראות שימוש..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">גרסה</label>
                <input required value={version} onChange={(e) => setVersion(e.target.value)} className="input-field" placeholder="למשל: 1.0.0" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">קטגוריה</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><FileArchive className="h-4 w-4" /> קובץ ההתקנה (APK לאפליקציה, או קובץ ההתקנה של התוכנה)</label>
              <input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white" />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><ImageIcon className="h-4 w-4" /> אייקון (אופציונלי)</label>
              <input type="file" accept="image/*" onChange={(e) => setIcon(e.target.files?.[0] ?? null)} className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white" />
              <p className="mt-1.5 text-xs text-gray-500">אם לא תעלו אייקון וקובץ האפליקציה הוא APK/APKS, ננסה לחלץ אותו אוטומטית מתוך הקובץ עצמו. אם גם זה לא יצליח, נבקש מכם להעלות תמונה לפני שנסיים.</p>
            </div>

            <button type="submit" disabled={status === "uploading" || status === "extracting-icon"} className="btn-primary mt-2 w-full">
              {(status === "uploading" || status === "extracting-icon") ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {status === "extracting-icon" ? "מחלץ אייקון מהקובץ..." : status === "uploading" ? "מעלה..." : "שלח לבדיקה"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
