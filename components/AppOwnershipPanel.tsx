"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Search, Loader2, Globe, Lock, Download, ThumbsUp, AlertCircle, Check, X } from "lucide-react";

type Source = "public_suggestion" | "developer_upload";
type AppItem = {
  id: string;
  name: string;
  source: Source;
  status: string;
  downloads: number;
  likes: number;
  owner: string;
  developerName: string | null;
};
type Preview = {
  appName: string;
  fromSource: Source;
  toSource: Source;
  from: { username: string };
  to: { username: string };
  ownerChanges: boolean;
  loggedPoints: number;
  likePointsOut: number;
  likePointsIn: number;
};

const SOURCE_LABEL: Record<Source, string> = { public_suggestion: "ציבורית", developer_upload: "פרטית" };

// טאב "ציבורי ופרטי" (מנהל + צוות פיקוח): העברת אפליקציה ציבורית לבעלות פרטית של מפתח
// ולהפך, כולל החלפת בעלים - והמוניטין שהאפליקציה צברה עובר איתה (ראו lib/appOwnership.ts).
export default function AppOwnershipPanel() {
  const [q, setQ] = useState("");
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toSource, setToSource] = useState<Source>("developer_upload");
  const [toUsername, setToUsername] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneMsg, setDoneMsg] = useState("");

  async function load(query: string) {
    setLoading(true);
    const res = await fetch(`/api/staff/app-ownership?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setApps(json.apps ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  function openFor(app: AppItem) {
    setOpenId(app.id);
    setToSource(app.source === "public_suggestion" ? "developer_upload" : "public_suggestion");
    setToUsername("");
    setPreview(null);
    setError("");
    setDoneMsg("");
  }

  async function call(appId: string, confirm: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/staff/app-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, toSource, toUsername, confirm })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setPreview(null);
      setError(json.error || "שגיאה");
      return;
    }
    if (!confirm) {
      setPreview(json.preview);
      return;
    }
    setOpenId(null);
    setPreview(null);
    setDoneMsg(`"${json.result.appName}" הועברה בהצלחה.`);
    load(q);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black">
          <ArrowLeftRight className="h-5 w-5 text-primary-light" /> ציבורי ופרטי
        </h2>
        <p className="text-sm text-gray-400">
          העברת אפליקציה ציבורית לבעלות פרטית של מפתח (הוא יוכל לערוך אותה ולהעלות גרסאות), או הפיכת אפליקציה פרטית
          לציבורית (נעולה לעריכה). אפשר גם להחליף את הבעלים. כשהבעלים מתחלף, כל המוניטין שהאפליקציה צברה עובר איתו -
          הבונוס על ההעלאה, ההורדות והלייקים. לפני כל העברה מוצגת תצוגה מקדימה.
        </p>
      </div>

      {doneMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent">
          <Check className="h-4 w-4" /> {doneMsg}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש אפליקציה לפי שם..." className="input-field w-full pe-10" />
      </div>

      {loading ? (
        <div className="card flex items-center justify-center p-10 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : apps.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">לא נמצאו אפליקציות</div>
      ) : (
        <div className="flex flex-col gap-2">
          {apps.map((a) => (
            <div key={a.id} className="card flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/apps/${a.id}`} target="_blank" className="font-bold text-white hover:underline">{a.name}</Link>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      a.source === "public_suggestion" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary-light"
                    }`}>
                      {a.source === "public_suggestion" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {SOURCE_LABEL[a.source]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>בעלים: <b className="text-gray-300" data-no-translate>{a.owner}</b></span>
                    {a.developerName && <span>מפתח מקורי: <span data-no-translate>{a.developerName}</span></span>}
                    <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> {a.downloads}</span>
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {a.likes}</span>
                  </div>
                </div>
                <button
                  onClick={() => (openId === a.id ? setOpenId(null) : openFor(a))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-xs font-bold text-primary-light hover:bg-primary/25"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" /> העברה
                </button>
              </div>

              {openId === a.id && (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface2 p-4">
                  <div className="flex flex-wrap gap-2">
                    {(["developer_upload", "public_suggestion"] as Source[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setToSource(s); setPreview(null); }}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                          toSource === s ? "bg-primary text-[#fff]" : "bg-surface text-gray-400 hover:text-white"
                        }`}
                      >
                        {s === "public_suggestion" ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        {s === "public_suggestion" ? "לציבורית" : "לפרטית"}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      {toSource === "developer_upload" ? "למי תהיה שייכת (שם משתמש של מפתח)" : "למי הקרדיט (שם משתמש)"}
                    </label>
                    <input
                      value={toUsername}
                      onChange={(e) => { setToUsername(e.target.value); setPreview(null); }}
                      placeholder={`ריק = נשאר אצל ${a.owner}`}
                      className="input-field"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                    </div>
                  )}

                  {preview && (
                    <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
                      <p className="font-bold text-white">
                        {SOURCE_LABEL[preview.fromSource]} ← {SOURCE_LABEL[preview.toSource]}
                        {preview.ownerChanges && <> · <span data-no-translate>{preview.from.username}</span> ← <span data-no-translate>{preview.to.username}</span></>}
                      </p>
                      {preview.ownerChanges ? (
                        <ul className="mt-1.5 list-disc ps-5 text-xs text-gray-300">
                          <li><span data-no-translate>{preview.from.username}</span> יאבד {preview.loggedPoints + preview.likePointsOut} מוניטין</li>
                          <li><span data-no-translate>{preview.to.username}</span> יקבל {preview.loggedPoints + preview.likePointsIn} מוניטין</li>
                          <li className="text-gray-500">פירוט: העלאה והורדות {preview.loggedPoints}, לייקים {preview.likePointsOut}</li>
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-gray-400">הבעלים לא מתחלף - המוניטין לא משתנה.</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!preview ? (
                      <button onClick={() => call(a.id, false)} disabled={busy} className="btn-ghost text-xs">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} תצוגה מקדימה
                      </button>
                    ) : (
                      <button onClick={() => call(a.id, true)} disabled={busy} className="btn-primary text-xs">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} אישור העברה
                      </button>
                    )}
                    <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1 px-3 text-xs text-gray-500 hover:text-white">
                      <X className="h-3.5 w-3.5" /> ביטול
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
