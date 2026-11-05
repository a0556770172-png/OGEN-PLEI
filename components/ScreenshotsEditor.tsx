"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Images, X, Loader2, Save, AlertCircle, CheckCircle2, Clapperboard, Trash2 } from "lucide-react";
import DropZone from "@/components/DropZone";
import { putToR2 } from "@/lib/uploadHelpers";
import { screenshotUrl } from "@/lib/appPath";
import { MAX_VIDEO_MB, MAX_VIDEO_BYTES, isAllowedVideoType } from "@/lib/media";

const MAX_SCREENSHOTS = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function Thumb({ src, alt, onRemove, isNew }: { src: string; alt: string; onRemove: () => void; isNew?: boolean }) {
  return (
    <div className={`relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border bg-surface2 ${isNew ? "border-primary/60" : "border-white/10"}`} onClick={(e) => e.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt={alt} className="h-full w-full object-cover" />}
      {isNew && <span className="absolute bottom-1 right-1 rounded bg-primary px-1 text-[10px] font-bold text-white">חדש</span>}
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

function NewThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <Thumb src={src} alt={file.name} onRemove={onRemove} isNew />;
}

// ניהול המדיה של אפליקציה קיימת (דף עריכת אפליקציה אצל המפתח, וטאב "תמונות" אצל הצוות):
// סרטון הסבר (העלאה / החלפה / מחיקה) וצילומי מסך (הוספה בגרירה/הדבקה/בחירה, הסרה, שמירה).
// הכול מוצג למשתמשים בלחיצה על "איך זה נראה?" בעמוד האפליקציה.
export default function ScreenshotsEditor({
  appId,
  initialKeys,
  initialVideoKey = null
}: {
  appId: string;
  initialKeys: string[];
  initialVideoKey?: string | null;
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<string[]>(initialKeys);
  const [savedKeys, setSavedKeys] = useState<string[]>(initialKeys);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [videoKey, setVideoKey] = useState<string | null>(initialVideoKey);
  const [videoBusy, setVideoBusy] = useState(false);

  const total = keys.length + newFiles.length;
  const dirty = newFiles.length > 0 || keys.length !== savedKeys.length || keys.some((k, i) => k !== savedKeys[i]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "שגיאה בשמירה");
    return json;
  }

  // ---- סרטון ----
  async function replaceVideo(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!isAllowedVideoType(f.type)) { setError("אפשר להעלות סרטון MP4 או WEBM בלבד"); return; }
    if (f.size > MAX_VIDEO_BYTES) { setError(`הסרטון גדול מדי (מקסימום ${MAX_VIDEO_MB}MB)`); return; }
    setVideoBusy(true);
    setError("");
    setMsg("");
    try {
      const init = await patch({ videoUploadRequest: { fileName: f.name, contentType: f.type, fileSize: f.size } });
      await putToR2(init.videoUpload.uploadUrl, f);
      await patch({ videoKey: init.videoUpload.key });
      setVideoKey(init.videoUpload.key);
      setMsg("הסרטון נשמר!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "שגיאה בהעלאת הסרטון");
    } finally {
      setVideoBusy(false);
    }
  }

  async function removeVideo() {
    if (!confirm("למחוק את סרטון ההסבר של האפליקציה?")) return;
    setVideoBusy(true);
    setError("");
    setMsg("");
    try {
      await patch({ videoKey: null });
      setVideoKey(null);
      setMsg("הסרטון נמחק");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "שגיאה במחיקת הסרטון");
    } finally {
      setVideoBusy(false);
    }
  }

  // ---- צילומי מסך ----
  function addFiles(files: File[]) {
    setMsg("");
    const images = files.filter((f) => f.type.startsWith("image/"));
    const ok = images.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (images.length < files.length) setError("אפשר להוסיף קבצי תמונה בלבד");
    else if (ok.length < images.length) setError("חלק מהתמונות גדולות מדי (מקסימום 5MB לתמונה) ולא נוספו");
    else setError("");
    setNewFiles((prev) => {
      const room = Math.max(0, MAX_SCREENSHOTS - keys.length - prev.length);
      if (ok.length > room) setError(`אפשר להחזיק עד ${MAX_SCREENSHOTS} צילומי מסך`);
      return [...prev, ...ok.slice(0, room)];
    });
  }

  // הדבקת תמונה (Ctrl+V) בכל מקום בעמוד שאינו שדה טקסט
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.length]);

  async function save() {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const uploadedKeys: string[] = [];
      if (newFiles.length) {
        const initJson = await patch({ screenshotUploadRequests: newFiles.map((f) => ({ fileName: f.name, contentType: f.type })) });
        const uploads: { key: string; uploadUrl: string }[] = initJson.screenshotUploads ?? [];
        for (let i = 0; i < uploads.length; i++) {
          await putToR2(uploads[i].uploadUrl, newFiles[i]);
          uploadedKeys.push(uploads[i].key);
        }
      }
      const finalKeys = [...keys, ...uploadedKeys];
      await patch({ screenshotKeys: finalKeys });
      setKeys(finalKeys);
      setSavedKeys(finalKeys);
      setNewFiles([]);
      setMsg("צילומי המסך נשמרו!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card flex flex-col gap-5 p-6">
      <div>
        <h2 className="font-bold text-white">סרטון הסבר וצילומי מסך</h2>
        <p className="text-xs text-gray-500">
          מוצגים למשתמשים בלחיצה על &quot;איך זה נראה?&quot; בעמוד האפליקציה. סרטון ההסבר מתנגן אוטומטית כשהם פותחים.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-white"><Clapperboard className="h-4 w-4" /> סרטון הסבר</h3>
        {videoKey && (
          <div className="flex flex-wrap items-start gap-3">
            <video src={screenshotUrl(videoKey)} controls muted playsInline preload="metadata" className="max-h-52 rounded-lg border border-white/10 bg-black" />
            <button
              type="button"
              onClick={removeVideo}
              disabled={videoBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> מחיקת הסרטון
            </button>
          </div>
        )}
        <DropZone
          accept="video/mp4,video/webm,video/quicktime"
          onFiles={replaceVideo}
          icon={videoBusy ? <Loader2 className="h-6 w-6 animate-spin text-primary-light" /> : <Clapperboard className="h-6 w-6 text-primary-light" />}
          title={videoBusy ? "מעלה את הסרטון..." : videoKey ? "גררו סרטון חדש להחלפה, או לחצו לבחירה" : "גררו לכאן סרטון הסבר, או לחצו לבחירה"}
          hint={`MP4 / WEBM עד ${MAX_VIDEO_MB}MB · אפשר גם סרטון שנוצר בבינה מלאכותית (AI)`}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-white"><Images className="h-4 w-4" /> צילומי מסך</h3>
        <DropZone
          accept="image/*"
          multiple
          onFiles={addFiles}
          icon={<Images className="h-6 w-6 text-primary-light" />}
          title="גררו צילומי מסך לכאן, הדביקו (Ctrl+V), או לחצו לבחירה"
          hint={`${total}/${MAX_SCREENSHOTS} - PNG / JPG / WEBP עד 5MB לתמונה`}
        >
          {total > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {keys.map((k) => (
                <Thumb key={k} src={screenshotUrl(k)} alt="צילום מסך" onRemove={() => setKeys((prev) => prev.filter((x) => x !== k))} />
              ))}
              {newFiles.map((f, i) => (
                <NewThumb key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
        </DropZone>
        <button type="button" onClick={save} disabled={!dirty || saving} className="btn-primary w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמירת צילומי המסך
        </button>
      </div>
    </div>
  );
}
