"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UploadCloud, Loader2, AlertCircle, CheckCircle2, FileArchive, Image as ImageIcon } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { putToR2, extractIconFailureReason } from "@/lib/uploadHelpers";
import type { Category } from "@/types/database";

export default function UploadAppPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting-icon" | "done">("idle");

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

      // האייקון הוא תוספת נחמדה-שיהיה, לא קריטי. אם ההעלאה שלו נכשלת (למשל דלי
      // ה-assets שכחו להגדיר לו CORS), לא רוצים לאבד את קובץ האפליקציה הגדול שכבר
      // עלה בהצלחה — פשוט ממשיכים בלי אייקון ומזהירים את המשתמש בסוף.
      let iconUploadFailed = false;
      let iconExtractNote = "";
      let uploadedIconKey: string | null = null;
      if (icon && initJson.iconUploadUrl) {
        try {
          await putToR2(initJson.iconUploadUrl, icon);
          uploadedIconKey = initJson.iconKey;
        } catch {
          iconUploadFailed = true;
        }
      } else if (file.name.toLowerCase().endsWith(".apk")) {
        // לא הועלה אייקון ידנית — ננסה לחלץ אוטומטית מתוך קובץ ה-APK עצמו (הוא כבר מוטמע שם).
        // זו נוחות בלבד: אם זה נכשל, ממשיכים בלי אייקון, אבל כן מציגים למפתח הסבר קצר למה.
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
          } else {
            const baseNote = extractIconFailureReason(extractJson?.reason) || "";
            // מציגים גם את פרטי השגיאה המדויקים (אם יש) - כדי שתקלות שעדיין קורות
            // בפרודקשן יהיה אפשר לאבחן ולתקן במקום לקבל רק הודעה כללית
            iconExtractNote = extractJson?.detail ? `${baseNote} (פרטים טכניים: ${extractJson.detail})` : baseNote;
          }
        } catch {
          // מתעלמים בכוונה — זו רק נוחות
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

      setStatus("done");
      if (iconUploadFailed) {
        setError("שימו לב: האפליקציה נשמרה בהצלחה, אך העלאת האייקון נכשלה (ייתכן שחסר CORS על דלי ה-assets). אפשר להעלות אייקון בהמשך.");
      } else if (iconExtractNote && !uploadedIconKey) {
        setError(`שימו לב: האפליקציה נשמרה בהצלחה, אך חילוץ האייקון האוטומטי לא הצליח — ${iconExtractNote} ניתן להוסיף אייקון ידנית בעריכת האפליקציה.`);
      }
      setTimeout(() => router.push("/profile"), iconUploadFailed || iconExtractNote ? 3500 : 1200);
    } catch (err: any) {
      setStatus("idle");
      setError(err.message || "שגיאה כללית");
    }
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
              <input value={version} onChange={(e) => setVersion(e.target.value)} className="input-field" placeholder="1.0.0" />
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
            <p className="mt-1.5 text-xs text-gray-500">אם לא תעלו אייקון וקובץ האפליקציה הוא APK, ננסה לחלץ אותו אוטומטית מתוך הקובץ עצמו.</p>
          </div>

          <button type="submit" disabled={status === "uploading" || status === "extracting-icon"} className="btn-primary mt-2 w-full">
            {(status === "uploading" || status === "extracting-icon") ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {status === "extracting-icon" ? "מחלץ אייקון מהקובץ..." : status === "uploading" ? "מעלה..." : "שלח לבדיקה"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
