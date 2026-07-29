"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Save, UploadCloud, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon, FileArchive } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import StatusBadge from "@/components/StatusBadge";
import { LIMITS } from "@/lib/constants";
import { putToR2 } from "@/lib/uploadHelpers";
import type { AppRow, Category } from "@/types/database";

export default function EditAppForm({
  app,
  isPro,
  categories
}: {
  app: AppRow;
  isPro: boolean;
  categories: Category[];
}) {
  const router = useRouter();

  // --- עריכת פרטי פרסום ---
  const [name, setName] = useState(app.name);
  const [shortDescription, setShortDescription] = useState(app.short_description);
  const [descriptionHtml, setDescriptionHtml] = useState(app.description_html);
  const [category, setCategory] = useState(app.category);
  const [icon, setIcon] = useState<File | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState("");
  const [detailsErr, setDetailsErr] = useState("");

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsErr("");
    setDetailsMsg("");
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          shortDescription,
          descriptionHtml,
          category,
          iconFileName: icon?.name,
          iconContentType: icon?.type
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בשמירה");

      if (icon && json.iconUploadUrl) {
        await putToR2(json.iconUploadUrl, icon);
      }

      setDetailsMsg("הפרטים נשמרו בהצלחה!");
      router.refresh();
    } catch (err: any) {
      setDetailsErr(err.message || "שגיאה כללית");
    } finally {
      setSavingDetails(false);
    }
  }

  // --- העלאת גרסה חדשה ---
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNumber, setVersionNumber] = useState(app.version);
  const [versionStatus, setVersionStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [versionErr, setVersionErr] = useState("");

  async function uploadNewVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!versionFile) return;
    setVersionStatus("uploading");
    setVersionErr("");
    try {
      const initRes = await fetch(`/api/apps/${app.id}/version-upload-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: versionFile.name,
          fileSize: versionFile.size,
          contentType: versionFile.type || "application/octet-stream"
        })
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error || "שגיאה באתחול ההעלאה");

      await putToR2(initJson.uploadUrl, versionFile);

      const finalizeRes = await fetch(`/api/apps/${app.id}/version-finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey: initJson.fileKey,
          fileName: versionFile.name,
          fileSize: versionFile.size,
          version: versionNumber
        })
      });
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeJson.error || "שגיאה בשמירת הגרסה");

      setVersionStatus("done");
      setVersionFile(null);
      router.refresh();
    } catch (err: any) {
      setVersionStatus("idle");
      setVersionErr(err.message || "שגיאה כללית");
    }
  }

  const plan = isPro ? LIMITS.pro : LIMITS.free;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-black">עריכת {app.name}</h1>
          <StatusBadge status={app.status} />
        </div>
        <p className="text-sm text-gray-400">כאן אפשר לעדכן את פרטי הפרסום, או להעלות גרסה חדשה.</p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={saveDetails}
        className="card flex flex-col gap-4 p-6"
      >
        <h2 className="font-bold text-white">פרטי הפרסום</h2>

        {detailsErr && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {detailsErr}
          </div>
        )}
        {detailsMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {detailsMsg}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">שם האפליקציה / התוכנה</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">תיאור קצר (יוצג בכרטיס)</label>
          <input required maxLength={140} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">תיאור מלא</label>
          <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} placeholder="תארו את האפליקציה..." />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">קטגוריה</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><ImageIcon className="h-4 w-4" /> החלפת אייקון (אופציונלי)</label>
          <input type="file" accept="image/*" onChange={(e) => setIcon(e.target.files?.[0] ?? null)} className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white" />
        </div>

        <button type="submit" disabled={savingDetails} className="btn-primary mt-2 w-full sm:w-auto">
          {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמירת שינויים
        </button>
      </motion.form>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={uploadNewVersion}
        className="card flex flex-col gap-4 p-6"
      >
        <div>
          <h2 className="font-bold text-white">העלאת גרסה חדשה</h2>
          <p className="text-xs text-gray-500">
            העלאת קובץ חדש תשלח את האפליקציה שוב לבדיקה ידנית לפני שהגרסה החדשה תתפרסם. הגרסה הנוכחית תישאר זמינה עד לאישור.
          </p>
        </div>

        {versionErr && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {versionErr}
          </div>
        )}
        {versionStatus === "done" && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> הגרסה החדשה הועלתה וממתינה לבדיקה!
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">מספר גרסה</label>
            <input value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} className="input-field" placeholder="1.0.1" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><FileArchive className="h-4 w-4" /> קובץ חדש (עד {plan.maxFileMb}MB)</label>
            <input type="file" onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)} className="input-field file:ms-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white" />
          </div>
        </div>

        <button type="submit" disabled={!versionFile || versionStatus === "uploading"} className="btn-primary mt-2 w-full sm:w-auto">
          {versionStatus === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          העלאת הגרסה החדשה
        </button>
      </motion.form>
    </div>
  );
}
