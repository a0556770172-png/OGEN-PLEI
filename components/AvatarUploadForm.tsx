"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, AlertCircle, CheckCircle2, User } from "lucide-react";
import { putToR2 } from "@/lib/uploadHelpers";

export default function AvatarUploadForm({
  currentAvatarUrl,
  username
}: {
  currentAvatarUrl: string | null;
  username: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleFile(file: File) {
    setError("");
    setSuccess(false);
    setBusy(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    try {
      const initRes = await fetch("/api/profile/avatar/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type })
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error || "שגיאה באתחול ההעלאה");

      await putToR2(initJson.uploadUrl, file);

      const finalizeRes = await fetch("/api/profile/avatar/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarKey: initJson.avatarKey })
      });
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeJson.error || "שגיאה בשמירת התמונה");

      setPreview(finalizeJson.url);
      setSuccess(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {error && (
        <div className="flex w-full items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex w-full items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> תמונת הפרופיל עודכנה בהצלחה!
        </div>
      )}

      <div className="relative">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-2 ring-border">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={username} className="h-full w-full object-cover" />
          ) : (
            <User className="h-12 w-12 text-primary-light" />
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute -bottom-1 -left-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[#fff] shadow-glow transition hover:scale-105"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
      </div>

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

      <p className="text-center text-sm font-bold text-white">{username}</p>
      <p className="text-center text-xs text-gray-500">לחצו על סמל המצלמה כדי להעלות תמונת פרופיל חדשה (עד 5MB)</p>
    </div>
  );
}
