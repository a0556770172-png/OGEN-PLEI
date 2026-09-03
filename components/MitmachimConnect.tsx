"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Check, X, ExternalLink, Pencil } from "lucide-react";
import { parseMitmachimUrl } from "@/lib/mitmachim";

// כפתור/כרטיס "חיבור לפרופיל במתמחים טופ" - המשתמש מדביק את הקישור לפרופיל שלו בפורום,
// והוא מוצג בפרופיל הציבורי שלו (ראו app/users/[id]/page.tsx).
export default function MitmachimConnect({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handle = url ? parseMitmachimUrl(url).handle : null;

  async function save(next: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/profile/mitmachim", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: next })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "שגיאה בשמירה");
      return;
    }
    setUrl(json.url ?? null);
    setInput(json.url ?? "");
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="card mx-auto flex w-full max-w-xl flex-col gap-3 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
          <Link2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white">חיבור לפרופיל במתמחים טופ</p>
          <p className="text-sm text-gray-400">
            {url
              ? "הקישור מוצג בפרופיל הציבורי שלך — כל מי שנכנס לפרופיל שלך יכול להגיע לפרופיל שלך בפורום."
              : "הדביקו את הקישור לפרופיל שלכם ב-mitmachim.top, והוא יופיע בפרופיל הציבורי שלכם באתר."}
          </p>
        </div>
      </div>

      {url && !editing && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold text-primary-light transition hover:bg-primary/20"
          >
            <ExternalLink className="h-4 w-4" /> {handle ? `@${handle}` : "הפרופיל שלי בפורום"}
          </a>
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
            <Pencil className="h-3.5 w-3.5" /> שינוי
          </button>
          <button onClick={() => save("")} disabled={busy} className="rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
            <X className="me-1 inline h-3.5 w-3.5" /> הסרה
          </button>
        </div>
      )}

      {(!url || editing) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            dir="ltr"
            placeholder="https://mitmachim.top/user/שם-המשתמש"
            className="input-field flex-1"
          />
          <button onClick={() => save(input)} disabled={busy || !input.trim()} className="btn-primary shrink-0 text-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {url ? "שמירה" : "חיבור"}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(false);
                setInput(url ?? "");
                setError("");
              }}
              className="btn-ghost shrink-0 text-sm"
            >
              ביטול
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
