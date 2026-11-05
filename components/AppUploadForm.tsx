"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { UploadCloud, Loader2, AlertCircle, CheckCircle2, FileArchive, Image as ImageIcon, Sparkles, ShieldAlert, RefreshCw, X, Link2, Images } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import UploadSuccess from "@/components/UploadSuccess";
import { putToR2, extractIconFailureReason } from "@/lib/uploadHelpers";
import { MIN_ANDROID_VERSIONS } from "@/lib/androidVersions";
import { parseApkForForm } from "@/lib/apkManifest";
import FileKindNotice from "@/components/FileKindNotice";
import DropZone from "@/components/DropZone";
import type { AppRow, Category } from "@/types/database";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_SCREENSHOTS = 8;
// גודל מקסימלי לחילוץ אייקון/שם חבילה אוטומטי (זהה ל-lib/extractIcon.ts בשרת)
const MAX_AUTO_EXTRACT_BYTES = 35 * 1024 * 1024;

// תצוגה מקדימה קטנה של תמונה שנבחרה (עם כפתור הסרה)
function Thumb({ file, onRemove, className = "h-20 w-20" }: { file: File; onRemove: () => void; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg border border-white/10 bg-surface2 ${className}`} onClick={(e) => e.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt={file.name} className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500"
        aria-label="הסרה"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// טופס העלאה משותף:
//   * mode="new" - העלאת אפליקציה/תוכנה חדשה (app/dashboard/developer/upload)
//   * mode="update" - "עדכן את האפליקציה" לאפליקציה ציבורית (app/apps/[id]/update): כל הפרטים
//     מגיעים ממולאים מהאפליקציה, והגרסה נשלחת לבדיקת הצוות. באישור - המעלה הופך לבעלים.
// משתמש ב-useSearchParams (מילוי מראש מהעוזר החכם) - יש לעטוף ב-Suspense.
export default function AppUploadForm({ mode = "new", targetApp }: { mode?: "new" | "update"; targetApp?: AppRow }) {
  const isUpdate = mode === "update" && !!targetApp;
  const searchParams = useSearchParams();
  // מילוי מראש מהעוזר החכם (start_upload) - הבוט מעביר לכאן עם השדות שסוכמו בשיחה.
  const [prefilledByBot, setPrefilledByBot] = useState(false);
  const [name, setName] = useState(isUpdate ? targetApp.name : "");
  const [shortDescription, setShortDescription] = useState(isUpdate ? targetApp.short_description : "");
  const [descriptionHtml, setDescriptionHtml] = useState(isUpdate ? targetApp.description_html : "");
  // בעדכון - מספר הגרסה החדשה מתחיל ריק בכוונה (הנוכחית מוצגת כ-placeholder), כדי שלא יישלח בטעות אותו מספר.
  const [version, setVersion] = useState("");
  // בכוונה בלי ברירת מחדל - חובה על המפתח לבחור בעצמו את גרסת האנדרואיד המינימלית, כדי
  // שלא תתפרסם בטעות גרסה שגויה שרק "נשארה מסומנת" מברירת המחדל.
  const [minAndroidVersion, setMinAndroidVersion] = useState(isUpdate ? targetApp.min_android_version ?? "" : "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState(isUpdate ? targetApp.category : "general");
  // קובץ ZIP - המשתמש בוחר אם לפרסם באפליקציות או בתוכנות (lib/fileKind.ts)
  const [zipTarget, setZipTarget] = useState<"apk" | "software">("apk");
  const [file, setFile] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  // צילומי מסך (עד 8) - רק בהעלאה חדשה
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [iconUrlInput, setIconUrlInput] = useState("");
  const [iconUrlLoading, setIconUrlLoading] = useState(false);
  // לאן הולכת תמונה שמודבקת (Ctrl+V) בעמוד: לאזור שהעכבר/הפוקוס נמצא בו לאחרונה
  const activeZone = useRef<"icon" | "shots">("icon");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting-icon" | "needs-icon" | "done">("idle");
  // מה שנשלף אוטומטית מתוך ה-APK בעת בחירת הקובץ (גרסת אנדרואיד מינ׳, מספר גרסה).
  const [autoDetected, setAutoDetected] = useState<string[]>([]);

  function pickIcon(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("האייקון חייב להיות קובץ תמונה"); return; }
    if (f.size > MAX_IMAGE_BYTES) { setError("תמונת האייקון גדולה מדי (מקסימום 5MB)"); return; }
    setError("");
    setIcon(f);
  }

  function addScreenshots(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const ok = images.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (images.length < files.length) setError("אפשר להוסיף כצילומי מסך קבצי תמונה בלבד");
    else if (ok.length < images.length) setError("חלק מהתמונות גדולות מדי (מקסימום 5MB לתמונה) ולא נוספו");
    else setError("");
    setScreenshots((prev) => {
      if (prev.length + ok.length > MAX_SCREENSHOTS) setError(`אפשר להוסיף עד ${MAX_SCREENSHOTS} צילומי מסך`);
      return [...prev, ...ok].slice(0, MAX_SCREENSHOTS);
    });
  }

  // הבאת תמונה מקישור (דרך השרת - הדפדפן לא יכול בגלל CORS) והפיכתה לקובץ
  async function fetchImageFile(url: string): Promise<File> {
    const res = await fetch("/api/apps/fetch-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.error || "לא הצלחנו להביא את התמונה מהקישור");
    }
    const blob = await res.blob();
    const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : blob.type.includes("gif") ? "gif" : "jpg";
    return new File([blob], `image-from-link.${ext}`, { type: blob.type });
  }

  async function useIconFromUrl() {
    const url = iconUrlInput.trim();
    if (!url) return;
    setIconUrlLoading(true);
    setError("");
    try {
      pickIcon([await fetchImageFile(url)]);
      setIconUrlInput("");
    } catch (err: any) {
      setError(err.message || "לא הצלחנו להביא את התמונה מהקישור");
    } finally {
      setIconUrlLoading(false);
    }
  }

  // הדבקת תמונה (Ctrl+V) בכל מקום בעמוד שאינו שדה טקסט - נכנסת לאייקון או לצילומי המסך
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      if (activeZone.current === "shots" && !isUpdate) addScreenshots(files);
      else pickIcon(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // לפני שהעלאה בפועל מתחילה, מציגים חלונית אישור עם הגרסה והקטגוריה שנבחרו - מטרתה
  // רק לגרום למפתח לעצור רגע ולוודא שהוא לא בחר בטעות גרסה ישנה/לא נכונה, או קטגוריה
  // לא מתאימה. זה לא בדיקה טכנית, רק תזכורת - הוא עדיין יכול לאשר ולהמשיך בכל מקרה.
  const [showConfirm, setShowConfirm] = useState(false);
  // אם המפתח מסמן שהאפליקציה עברה עריכה להמעטת פרסומות עבור נטפרי, מפרסמים אותה
  // בקטגוריה הייעודית "מותאם נטפרי" במקום הקטגוריה הרגילה שנבחרה בטופס.
  const [netfreeAdapted, setNetfreeAdapted] = useState(isUpdate && targetApp.category === "netfree");
  // האם האפליקציה/התוכנה פועלת אופליין, חייבת חיבור אינטרנט, או לא ידוע - נשאל באותה
  // חלונית אישור כמו שאלת הנטפרי, כדי שמשתמשים יידעו מראש מה לצפות.
  const [offlineSupport, setOfflineSupport] = useState<"offline" | "online" | "unknown">(isUpdate ? targetApp.offline_support ?? "unknown" : "unknown");

  // אחרי שהאפליקציה כבר נשמרה בהצלחה (ונשלחה לבדיקה) אבל בלי אייקון - שומרים את המזהה שלה
  // כדי לאפשר להשלים אייקון בשלב נפרד, בלי לבנות מחדש את כל שאר הטופס.
  const [pendingAppId, setPendingAppId] = useState<string | null>(null);
  const [followUpIcon, setFollowUpIcon] = useState<File | null>(null);
  const [savingIcon, setSavingIcon] = useState(false);
  const [doneNote, setDoneNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isUpdate) return;
    const pName = searchParams.get("name");
    const pShort = searchParams.get("short");
    const pDesc = searchParams.get("desc");
    const pMin = searchParams.get("minandroid");
    const pOffline = searchParams.get("offline");
    let touched = false;
    if (pName) { setName(pName.slice(0, 120)); touched = true; }
    if (pShort) { setShortDescription(pShort.slice(0, 140)); touched = true; }
    if (pDesc) { setDescriptionHtml(`<p>${pDesc.replace(/</g, "&lt;").slice(0, 4000)}</p>`); touched = true; }
    if (pMin) { setMinAndroidVersion(pMin); touched = true; }
    if (pOffline === "offline" || pOffline === "online" || pOffline === "unknown") { setOfflineSupport(pOffline); touched = true; }
    if (touched) setPrefilledByBot(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((json) => {
        const list: Category[] = json.categories ?? [];
        setCategories(list);
        const pCat = isUpdate ? null : searchParams.get("cat");
        if (pCat && list.some((c) => c.value === pCat)) setCategory(pCat);
        else if (list.length && !list.some((c) => c.value === category)) setCategory(list[0].value);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // קבצי APK/APKS גדולים מ-MAX_AUTO_EXTRACT_BYTES כמעט אף פעם לא מספיקים לעבור חילוץ בזמן
  // בשרת, אז אין טעם אפילו לנסות - עדיף לבקש אייקון ידני כבר עכשיו במקום אחרי כישלון.
  const isApkFile = !!file && (file.name.toLowerCase().endsWith(".apk") || file.name.toLowerCase().endsWith(".apks"));
  const canAutoExtract = isApkFile && !!file && file.size <= MAX_AUTO_EXTRACT_BYTES;
  // בעדכון - בלי אייקון חדש פשוט נשאר האייקון הקיים של האפליקציה.
  const iconRequiredNow = !isUpdate && !!file && !icon && !canAutoExtract;

  function openConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) { setError("יש לבחור קובץ להעלאה"); return; }
    if (!minAndroidVersion) { setError("חובה לבחור גרסת אנדרואיד מינימלית נדרשת"); return; }
    if (isUpdate && version.trim() === targetApp.version.trim()) {
      setError(`מספר הגרסה זהה לגרסה הנוכחית (${targetApp.version}) - יש להעלות גרסה חדשה יותר`);
      return;
    }
    if (iconRequiredNow) {
      setError(
        !isApkFile
          ? "לקובץ תוכנה (לא APK) אין אפשרות לחלץ אייקון אוטומטית - חובה להעלות תמונת אייקון ידנית לפני השליחה. אפשר גם ליצור אחת בעזרת AI."
          : "קובץ ה-APK גדול מ-35MB, ולכן חילוץ אייקון אוטומטי לא יצליח - חובה להעלות תמונת אייקון ידנית לפני השליחה. אפשר גם ליצור אחת בעזרת AI."
      );
      return;
    }
    setShowConfirm(true);
  }

  async function doUpload() {
    if (!file) { setError("יש לבחור קובץ להעלאה"); return; }
    setShowConfirm(false);
    setStatus("uploading");
    try {
      const initRes = await fetch(isUpdate ? `/api/apps/${targetApp.id}/update-proposal/upload-init` : "/api/apps/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "application/octet-stream",
          iconFileName: icon?.name,
          iconContentType: icon?.type,
          ...(!isUpdate && screenshots.length
            ? { screenshots: screenshots.map((s) => ({ fileName: s.name, contentType: s.type })) }
            : {})
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
      let packageName: string | undefined;
      const isApkUpload = file.name.toLowerCase().endsWith(".apk") || file.name.toLowerCase().endsWith(".apks");
      if (icon && initJson.iconUploadUrl) {
        try {
          await putToR2(initJson.iconUploadUrl, icon);
          uploadedIconKey = initJson.iconKey;
        } catch {
          iconUploadFailed = true;
        }
      } else if (!isUpdate && (file.name.toLowerCase().endsWith(".apk") || file.name.toLowerCase().endsWith(".apks"))) {
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
          if (extractRes.ok && extractJson?.packageName) packageName = extractJson.packageName;
        } catch {
          // מתעלמים בכוונה — ננסה שוב ידנית בשלב הבא אם באמת אין אייקון
        }
        setStatus("uploading");
      }

      // אייקון הועלה ידנית (או שהחילוץ לא החזיר שם חבילה) - עדיין קוראים את שם החבילה מה-APK,
      // כדי לבנות את כתובת העמוד של האפליקציה (/apps/com.myapp)
      if (!isUpdate && isApkUpload && !packageName && file.size <= MAX_AUTO_EXTRACT_BYTES) {
        try {
          const pkgRes = await fetch("/api/apps/extract-icon", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKey: initJson.fileKey, packageOnly: true })
          });
          const pkgJson = await pkgRes.json().catch(() => null);
          if (pkgRes.ok && pkgJson?.packageName) packageName = pkgJson.packageName;
        } catch {
          // לא קריטי - הכתובת תיבנה משם המעלה ושם האפליקציה
        }
      }

      // צילומי מסך: "רך" כמו האייקון - כישלון בהעלאה לא מפיל את ההעלאה כולה
      const screenshotKeys: string[] = [];
      if (!isUpdate && Array.isArray(initJson.screenshotUploads)) {
        for (let i = 0; i < initJson.screenshotUploads.length; i++) {
          try {
            await putToR2(initJson.screenshotUploads[i].uploadUrl, screenshots[i]);
            screenshotKeys.push(initJson.screenshotUploads[i].key);
          } catch {
            // מדלגים על התמונה שנכשלה
          }
        }
      }

      const finalizeRes = await fetch(isUpdate ? `/api/apps/${targetApp.id}/update-proposal/finalize` : "/api/apps/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          shortDescription,
          descriptionHtml,
          version,
          category: netfreeAdapted ? "netfree" : category,
          fileKey: initJson.fileKey,
          fileName: file.name,
          fileSize: file.size,
          iconKey: uploadedIconKey,
          minAndroidVersion,
          offlineSupport,
          zipTarget,
          packageName,
          screenshotKeys
        })
      });
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeJson.error || "שגיאה בשמירה");

      if (isUpdate) {
        if (iconUploadFailed) setDoneNote("שימו לב: העלאת האייקון החדש נכשלה - האפליקציה תישאר עם האייקון הקיים.");
        setStatus("done");
        return;
      }

      // האפליקציה כבר נשמרה ונשלחה לבדיקה בכל מקרה (גם אם אין אייקון) - זה לא תלוי
      // באייקון. ההבדל היחיד הוא איך מודיעים למפתח: אם אין אייקון, לא מציגים "בוצע
      // בהצלחה" סתמי אלא דורשים ממנו להשלים תמונה (לאו דווקא האייקון הרשמי) עכשיו.
      if (uploadedIconKey) {
        if (iconUploadFailed) setDoneNote("שימו לב: העלאת האייקון שבחרתם נכשלה - אפשר להוסיף אייקון בעריכת האפליקציה.");
        setStatus("done");
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
    } catch (err: any) {
      setError(err.message || "שגיאה בשמירת האייקון");
    } finally {
      setSavingIcon(false);
    }
  }

  function skipIconForNow() {
    // האפליקציה כבר נשלחה לבדיקה כרגיל - רק מסמנים לעצמנו (ולצוות הבדיקה) שאין לה
    // אייקון, כדי שהמנהל יוכל להזכיר למפתח להוסיף אחד מאוחר יותר.
    setDoneNote("אפשר להוסיף אייקון בכל עת דרך עריכת האפליקציה באזור המפתח.");
    setStatus("done");
  }

  // אחרי העלאה מוצלחת - מסך הצלחה ברור ("הועלתה ונשלחה לבדיקה") שחוזר לבד לדף הבית.
  if (status === "done") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8">
          <UploadSuccess kind={isUpdate ? "update" : "private"} note={doneNote} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
            {isUpdate ? <RefreshCw className="h-6 w-6 text-[#fff]" /> : <UploadCloud className="h-6 w-6 text-[#fff]" />}
          </div>
          {isUpdate ? (
            <>
              <h1 className="text-2xl font-black">עדכון האפליקציה {targetApp.name}</h1>
              <p className="text-sm text-gray-400">גרסה נוכחית בחנות: {targetApp.version}</p>
              <div className="mt-1 max-w-md rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-gray-300">
                <span className="mb-1 flex items-center justify-center gap-1.5 font-bold text-accent"><Sparkles className="h-3.5 w-3.5" /> איך זה עובד?</span>
                הגרסה שתעלו תישלח לבדיקה ידנית של צוות הפיקוח. אחרי האישור היא תחליף את הגרסה הקיימת בחנות,
                <b className="text-white"> האפליקציה תעבור לבעלותכם</b>, וכל ההורדות מעכשיו ייזקפו לכם. עד האישור הגרסה הנוכחית נשארת בחנות כרגיל.
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black">העלאת אפליקציה / תוכנה</h1>
              <p className="text-sm text-gray-400">האפליקציה או התוכנה תישלח לבדיקה ידנית לפני פרסום בחנות</p>
              <p className="max-w-md text-xs text-gray-500">
                זו העלאה פרטית משלך (בעלים = אתה) - בניגוד ל"הוספה למאגר הציבורי" (הצעת אפליקציה ציבורית), כאן תמיד תוכל לחזור
                ולערוך פרטים ולהעלות גרסאות חדשות בעתיד דרך "אזור מפתח" בפרופיל שלך.
              </p>
            </>
          )}
        </div>

        {prefilledByBot && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary-light">
            <Sparkles className="h-4 w-4 shrink-0" /> חלק מהשדות מולאו מראש מהשיחה עם העוזר החכם — בדקו, תקנו אם צריך, והוסיפו את הקובץ.
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
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
                className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[#fff]"
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
          <form onSubmit={openConfirm} className="flex flex-col gap-4">
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
                <label className="mb-1.5 block text-sm text-gray-400">{isUpdate ? "הגרסה החדשה" : "גרסה"}</label>
                <input required value={version} onChange={(e) => setVersion(e.target.value)} className="input-field" placeholder={isUpdate ? `הנוכחית: ${targetApp.version}` : "למשל: 1.0.0"} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">קטגוריה</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">גרסת אנדרואיד מינימלית נדרשת <span className="text-gold">(חובה)</span></label>
              <select required value={minAndroidVersion} onChange={(e) => setMinAndroidVersion(e.target.value)} className="input-field">
                <option value="" disabled>בחרו גרסה...</option>
                {MIN_ANDROID_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-gray-500">כדי שמשתמשים יידעו מראש אם המכשיר שלהם תואם, לפני שהם מורידים.</p>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><FileArchive className="h-4 w-4" /> קובץ ההתקנה (APK לאפליקציה, או קובץ ההתקנה של התוכנה)</label>
              <DropZone
                onFiles={(files) => handleFilePick(files[0] ?? null)}
                icon={<UploadCloud className="h-6 w-6 text-primary-light" />}
                title={file ? file.name : "גררו לכאן את קובץ ההתקנה, או לחצו לבחירה"}
                hint={file ? `${(file.size / (1024 * 1024)).toFixed(1)}MB - לחצו כדי להחליף` : "APK, או קובץ ההתקנה של התוכנה"}
              />
              <FileKindNotice file={file} zipTarget={zipTarget} onZipTargetChange={setZipTarget} />
              {autoDetected.length > 0 && (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-accent">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>זוהה אוטומטית מהקובץ ומולא בטופס (ניתן לשנות): {autoDetected.join(" · ")}</span>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400">
                <ImageIcon className="h-4 w-4" /> אייקון {iconRequiredNow ? <span className="text-gold">(חובה בקובץ הזה)</span> : "(אופציונלי)"}
              </label>
              <DropZone
                accept="image/*"
                onFiles={pickIcon}
                onActivate={() => { activeZone.current = "icon"; }}
                icon={icon ? undefined : <ImageIcon className="h-6 w-6 text-primary-light" />}
                title={icon ? icon.name : "גררו תמונה לכאן, הדביקו (Ctrl+V), או לחצו לבחירה"}
                hint={icon ? undefined : "PNG / JPG / WEBP עד 5MB"}
              >
                {icon && <Thumb file={icon} onRemove={() => setIcon(null)} />}
              </DropZone>
              <div className="mt-2 flex gap-2">
                <input
                  value={iconUrlInput}
                  onChange={(e) => setIconUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); useIconFromUrl(); } }}
                  dir="ltr"
                  className="input-field flex-1"
                  placeholder="או הדביקו קישור לתמונה: https://..."
                />
                <button
                  type="button"
                  onClick={useIconFromUrl}
                  disabled={!iconUrlInput.trim() || iconUrlLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm text-gray-300 hover:text-white disabled:opacity-50"
                >
                  {iconUrlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  הבא
                </button>
              </div>
              {iconRequiredNow ? (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-gold">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {!isApkFile
                      ? "קובץ תוכנה (לא APK) - אין דרך לחלץ ממנו אייקון אוטומטית."
                      : "קובץ ה-APK גדול מ-35MB - חילוץ אוטומטי לא יספיק לרוץ בזמן."}{" "}
                    חובה להעלות תמונה כאן לפני השליחה. אפשר גם ליצור אייקון בעזרת AI (למשל ChatGPT/Copilot) - לא חייב להיות דווקא האייקון הרשמי.
                  </span>
                </div>
              ) : isUpdate ? (
                <p className="mt-1.5 text-xs text-gray-500">אם לא תעלו אייקון חדש - יישאר האייקון הקיים של האפליקציה.</p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-500">אם לא תעלו אייקון וקובץ האפליקציה הוא APK/APKS עד 35MB, ננסה לחלץ אותו אוטומטית מתוך הקובץ עצמו.</p>
              )}
            </div>

            {!isUpdate && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400">
                  <Images className="h-4 w-4" /> צילומי מסך (אופציונלי, עד {MAX_SCREENSHOTS})
                </label>
                <DropZone
                  accept="image/*"
                  multiple
                  onFiles={addScreenshots}
                  onActivate={() => { activeZone.current = "shots"; }}
                  icon={<Images className="h-6 w-6 text-primary-light" />}
                  title="גררו צילומי מסך לכאן, הדביקו (Ctrl+V), או לחצו לבחירה"
                  hint={`${screenshots.length}/${MAX_SCREENSHOTS} - PNG / JPG / WEBP עד 5MB לתמונה`}
                >
                  {screenshots.length > 0 && (
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {screenshots.map((s, i) => (
                        <Thumb key={`${s.name}-${s.size}-${i}`} file={s} onRemove={() => setScreenshots((prev) => prev.filter((_, j) => j !== i))} className="h-24 w-16" />
                      ))}
                    </div>
                  )}
                </DropZone>
              </div>
            )}

            <button type="submit" disabled={status === "uploading" || status === "extracting-icon"} className="btn-primary mt-2 w-full">
              {(status === "uploading" || status === "extracting-icon") ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {status === "extracting-icon" ? "מחלץ אייקון מהקובץ..." : status === "uploading" ? "מעלה..." : isUpdate ? "שלח עדכון לבדיקה" : "שלח לבדיקה"}
            </button>
          </form>
        )}
      </motion.div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-gold" />
              <h2 className="text-lg font-bold text-white">רגע לפני שליחה - תבדקו שוב</h2>
            </div>
            <p className="mb-4 text-sm text-gray-400">
              נא לוודא שהפרטים האלה נכונים - במיוחד מספר הגרסה והקטגוריה, כדי שלא תעלה בטעות גרסה ישנה או קטגוריה
              לא מתאימה.
            </p>
            <div className="mb-5 flex flex-col gap-2 rounded-xl border border-white/10 bg-surface2 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">שם</span>
                <span className="font-bold text-white">{name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">גרסה</span>
                <span className="font-bold text-white">{isUpdate ? `${targetApp.version} ← ` : ""}{version || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">קטגוריה</span>
                <span className="font-bold text-white">
                  {netfreeAdapted ? "מותאם נטפרי" : categories.find((c) => c.value === category)?.label ?? category}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">גרסת אנדרואיד מינימלית</span>
                <span className="font-bold text-white">{minAndroidVersion}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">קובץ</span>
                <span className="max-w-[60%] truncate font-bold text-white">{file?.name}</span>
              </div>
            </div>

            <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-surface2 p-4 text-sm">
              <input
                type="checkbox"
                checked={netfreeAdapted}
                onChange={(e) => setNetfreeAdapted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-gray-300">
                האם האפליקציה עברה עריכה להמעטת פרסומות, כך שתתאים לגלישה מסוננת בנטפרי?
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
                      name="offlineSupport"
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
              <button onClick={doUpload} className="btn-primary flex-1">
                <CheckCircle2 className="h-4 w-4" /> כן, הכל נכון - שליחה
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
    </div>
  );
}
