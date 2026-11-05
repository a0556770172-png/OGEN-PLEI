"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ImageOff, Images, ChevronDown, ChevronUp, Loader2, Trash2, Ban, ShieldCheck, AlertCircle, CheckCircle2, Package } from "lucide-react";
import DropZone from "@/components/DropZone";
import ScreenshotsEditor from "@/components/ScreenshotsEditor";
import { putToR2 } from "@/lib/uploadHelpers";
import { screenshotUrl } from "@/lib/appPath";
import type { AppRow } from "@/types/database";

interface BannedUser {
  id: string;
  username: string;
  images_ban_reason: string | null;
  images_banned_at: string | null;
}

// חסימת משתמש מהעלאת תמונות (אייקון, צילומי מסך, תמונת פרופיל, תמונות בפניות) לפי שם משתמש.
function ImageBanSection() {
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [banned, setBanned] = useState<BannedUser[]>([]);

  async function load() {
    const res = await fetch("/api/admin/images-ban", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok) setBanned(json.users ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(name: string, ban: boolean, why?: string) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/images-ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, banned: ban, reason: why })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "הפעולה נכשלה");
      setMsg(ban ? `${json.username} נחסם מהעלאת תמונות` : `החסימה של ${json.username} בוטלה`);
      if (ban) {
        setUsername("");
        setReason("");
      }
      await load();
    } catch (err: any) {
      setError(err.message || "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-bold text-white"><Ban className="h-4 w-4 text-red-400" /> חסימת העלאת תמונות לפי שם משתמש</h2>
        <p className="text-xs text-gray-500">
          משתמש חסום לא יוכל להעלות אייקון, צילומי מסך, תמונת פרופיל או תמונות בפניות. שאר הפעולות באתר לא מושפעות.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="input-field sm:w-56" placeholder="שם משתמש" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="input-field flex-1" placeholder="סיבה (אופציונלי)" />
        <button
          type="button"
          disabled={!username.trim() || busy}
          onClick={() => submit(username.trim(), true, reason.trim())}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500/80 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} חסימה
        </button>
      </div>

      {banned.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-400">משתמשים חסומים מהעלאת תמונות ({banned.length})</p>
          {banned.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-surface2 px-3 py-2 text-sm">
              <div>
                <span className="font-bold text-white">{u.username}</span>
                {u.images_ban_reason && <span className="ms-2 text-xs text-gray-500">{u.images_ban_reason}</span>}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(u.username, false)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-300 hover:text-white disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> ביטול חסימה
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">אין כרגע משתמשים חסומים מהעלאת תמונות.</p>
      )}
    </div>
  );
}

// החלפה / מחיקה של האייקון של אפליקציה
function IconEditor({ app }: { app: AppRow }) {
  const router = useRouter();
  const [iconKey, setIconKey] = useState<string | null>(app.icon_key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function replace(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("יש לבחור קובץ תמונה"); return; }
    if (f.size > 5 * 1024 * 1024) { setError("התמונה גדולה מדי (מקסימום 5MB)"); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iconFileName: f.name, iconContentType: f.type })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בשמירת האייקון");
      await putToR2(json.iconUploadUrl, f);
      setIconKey(json.iconKey);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "שגיאה בשמירת האייקון");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("למחוק את האייקון של האפליקציה?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeIcon: true })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה במחיקת האייקון");
      setIconKey(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "שגיאה במחיקת האייקון");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-bold text-white">אייקון</h3>
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface2 ring-1 ring-border">
          {iconKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={screenshotUrl(iconKey)} alt={app.name} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-7 w-7 text-gray-500" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <DropZone accept="image/*" onFiles={replace} title={busy ? "שומר..." : iconKey ? "גררו אייקון חדש להחלפה, או לחצו לבחירה" : "גררו אייקון לכאן, או לחצו לבחירה"} hint="PNG / JPG / WEBP עד 5MB" />
          {iconKey && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> מחיקת האייקון
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { pending: "ממתינה", approved: "מאושרת", rejected: "נדחתה", archived: "בארכיון" };

// טאב "תמונות" לצוות (מנהל + פיקוח): החלפה והוספה ומחיקה של אייקון וצילומי מסך בכל אפליקציה
// באתר - פרטית או ציבורית - וחסימת משתמשים מהעלאת תמונות.
export default function ImagesManagerPanel({ apps }: { apps: AppRow[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  const q = query.trim().toLowerCase();
  const filtered = apps.filter((a) => {
    if (!q) return true;
    const dev = (a.developer as any)?.username ?? "";
    return a.name.toLowerCase().includes(q) || String(dev).toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-5">
      <ImageBanSection />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-white"><Images className="h-4 w-4" /> תמונות של אפליקציות ({filtered.length})</h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(30); }} className="input-field pr-9" placeholder="חיפוש לפי שם אפליקציה או מפתח" />
          </div>
        </div>

        {filtered.length === 0 && <div className="card p-6 text-center text-gray-500">לא נמצאו אפליקציות.</div>}

        {filtered.slice(0, limit).map((app) => {
          const open = openId === app.id;
          const shots = app.screenshot_keys?.length ?? 0;
          return (
            <div key={app.id} className="card overflow-hidden">
              <button type="button" onClick={() => setOpenId(open ? null : app.id)} className="flex w-full items-center gap-3 p-4 text-right">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface2 ring-1 ring-border">
                  {app.icon_key ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={screenshotUrl(app.icon_key)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{app.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {app.source === "public_suggestion" ? "ציבורית" : "פרטית"} · {STATUS_LABEL[app.status] ?? app.status}
                    {(app.developer as any)?.username ? ` · ${(app.developer as any).username}` : ""}
                    {" · "}
                    {app.icon_key ? "יש אייקון" : "אין אייקון"} · {shots} צילומי מסך
                  </p>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {open && (
                <div className="flex flex-col gap-4 border-t border-border p-4">
                  <IconEditor app={app} />
                  <ScreenshotsEditor appId={app.id} initialKeys={app.screenshot_keys ?? []} />
                </div>
              )}
            </div>
          );
        })}

        {filtered.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 30)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:text-white">
            הצג עוד
          </button>
        )}
      </div>
    </div>
  );
}
