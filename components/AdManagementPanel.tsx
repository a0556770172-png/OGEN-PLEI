"use client";
import { useEffect, useRef, useState } from "react";
import { Megaphone, Loader2, AlertCircle, CheckCircle2, MousePointerClick, Image as ImageIcon } from "lucide-react";
import { putToR2 } from "@/lib/uploadHelpers";
import AdImage from "./AdImage";
import type { AdAnimation } from "@/lib/adAnimation";

interface AdConfigState {
  interstitialEnabled: boolean;
  floatingEnabled: boolean;
  imageUrl: string | null;
  animation: AdAnimation | null;
  linkUrl: string;
  skipAfterSeconds: number;
  staffDailyLimit: number;
  clickCount: number;
}

export default function AdManagementPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState<AdConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ad-config")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setCfg(json);
      })
      .catch((e) => setError(e.message || "שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  async function save(patch: Record<string, any>) {
    if (!cfg) return;
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ad-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בשמירה");
      setCfg(json);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e.message || "שגיאה כללית");
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const initRes = await fetch("/api/admin/ad-config/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type })
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error || "שגיאה באתחול ההעלאה");

      await putToR2(initJson.uploadUrl, file);
      await save({ imageKey: initJson.imageKey });
    } catch (e: any) {
      setError(e.message || "שגיאה בהעלאת התמונה");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!cfg) {
    return <div className="card p-6 text-center text-red-400">{error || "שגיאה בטעינת הגדרות הפרסומת"}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold"><Megaphone className="h-5 w-5" /></div>
        <div>
          <h2 className="text-xl font-bold">ניהול פרסומות</h2>
          <p className="text-sm text-gray-500">פרסומת ביניים לפני הורדה + באדג' צף באתר. אותה תמונה וקישור לשניהם.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> נשמר בהצלחה
        </div>
      )}

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
        <div className="flex w-full max-w-[200px] flex-col items-center gap-2">
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface2">
            {cfg.imageUrl ? (
              <AdImage
                src={cfg.imageUrl}
                animation={cfg.animation}
                alt="פרסומת"
                className={cfg.animation ? "w-full" : "h-full w-full object-cover"}
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-gray-600" />
            )}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn-ghost w-full justify-center text-xs"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} החלפת תמונה/גיף
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-300">קישור היעד (לשם מפנה לחיצה על התמונה)</span>
            <input
              dir="ltr"
              defaultValue={cfg.linkUrl}
              onBlur={(e) => e.target.value !== cfg.linkUrl && save({ linkUrl: e.target.value })}
              className="input-field text-left text-sm"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-gray-300">שניות עד שאפשר לדלג (פרסומת הורדה)</span>
              <input
                type="number"
                min={0}
                max={60}
                defaultValue={cfg.skipAfterSeconds}
                onBlur={(e) => Number(e.target.value) !== cfg.skipAfterSeconds && save({ skipAfterSeconds: Number(e.target.value) })}
                className="input-field"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-gray-300">מגבלה יומית לצוות/מנהל</span>
              <input
                type="number"
                min={0}
                max={50}
                defaultValue={cfg.staffDailyLimit}
                onBlur={(e) => Number(e.target.value) !== cfg.staffDailyLimit && save({ staffDailyLimit: Number(e.target.value) })}
                className="input-field"
              />
              <span className="text-xs text-gray-500">למשתמשים רגילים הפרסומת מוצגת בכל הורדה, בלי הגבלה.</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={cfg.interstitialEnabled}
                onChange={(e) => save({ interstitialEnabled: e.target.checked })}
                className="h-4 w-4"
              />
              פרסומת ביניים לפני הורדה
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={cfg.floatingEnabled}
                onChange={(e) => save({ floatingEnabled: e.target.checked })}
                className="h-4 w-4"
              />
              באדג' צף באתר
            </label>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-gray-300">
            <MousePointerClick className="h-4 w-4 text-gold" /> סה"כ קליקים על הפרסומת: <b className="text-white">{cfg.clickCount.toLocaleString("he-IL")}</b>
          </div>

          {saving && <p className="text-xs text-gray-500">שומר…</p>}
        </div>
      </div>
    </div>
  );
}
