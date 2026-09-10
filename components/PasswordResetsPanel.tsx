"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, KeyRound, Check, X, Copy } from "lucide-react";

interface MatchProfile {
  id: string;
  username: string;
  email: string;
  created_at: string;
  role: string;
}
interface ResetReq {
  id: string;
  email: string;
  claimed_username: string | null;
  details: string | null;
  ip: string | null;
  status: string;
  created_at: string;
  matches: MatchProfile[];
}

export default function PasswordResetsPanel() {
  const [reqs, setReqs] = useState<ResetReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ id: string; pw: string } | null>(null);
  const [showHandled, setShowHandled] = useState(false);

  function load() {
    fetch("/api/admin/password-resets")
      .then((r) => r.json())
      .then((j) => setReqs(j.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    await fetch(`/api/admin/password-resets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    }).catch(() => {});
    setBusy(null);
    load();
  }

  async function userReset(userId: string, mode: "link" | "temp", reqId: string) {
    setBusy(reqId + mode);
    try {
      const res = await fetch("/api/admin/user-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && mode === "temp" && j.tempPassword) setTemp({ id: reqId, pw: j.tempPassword });
      alert(res.ok ? j.message : j.error || "שגיאה");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const shown = reqs.filter((r) => (showHandled ? true : r.status === "open"));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowHandled((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            showHandled ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"
          }`}
        >
          {showHandled ? "הכל" : "רק פתוחות"}
        </button>
        <span className="text-xs text-gray-500">{shown.length} בקשות</span>
      </div>

      {shown.length === 0 ? (
        <p className="card p-6 text-center text-sm text-gray-500">אין בקשות איפוס סיסמה ידניות.</p>
      ) : (
        shown.map((r) => (
          <div key={r.id} className={`card flex flex-col gap-2 p-4 ${r.status !== "open" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold text-white">{r.claimed_username || "—"}</span>
              <span dir="ltr" className="text-xs text-gray-400">{r.email}</span>
              <span className="text-xs text-gray-600">
                {new Date(r.created_at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              {r.status !== "open" && (
                <span className="rounded bg-surface2 px-1.5 text-[10px] text-gray-400">
                  {r.status === "handled" ? "טופל" : "נדחה"}
                </span>
              )}
            </div>

            {r.details && <p className="whitespace-pre-wrap rounded-lg bg-surface2/50 p-2 text-xs text-gray-300">{r.details}</p>}

            {r.matches.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-bold text-gray-500">חשבונות תואמים - ודא זהות לפני איפוס:</p>
                {r.matches.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface2/40 p-2 text-xs">
                    <Link href={`/users/${m.id}`} target="_blank" className="font-bold text-primary-light hover:underline">
                      {m.username}
                    </Link>
                    <span dir="ltr" className="text-gray-400">{m.email}</span>
                    <span className="text-gray-600">הצטרף {new Date(m.created_at).toLocaleDateString("he-IL")}</span>
                    <div className="ms-auto flex gap-1.5">
                      <button
                        onClick={() => userReset(m.id, "link", r.id)}
                        disabled={busy === r.id + "link"}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 font-bold text-primary-light hover:bg-primary/25"
                      >
                        {busy === r.id + "link" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />} קישור למייל
                      </button>
                      <button
                        onClick={() => userReset(m.id, "temp", r.id)}
                        disabled={busy === r.id + "temp"}
                        className="inline-flex items-center gap-1 rounded-lg bg-gold/15 px-2 py-1 font-bold text-gold hover:bg-gold/25"
                      >
                        {busy === r.id + "temp" ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />} סיסמה זמנית
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">לא נמצא חשבון תואם למייל/שם שנמסרו.</p>
            )}

            {temp && temp.id === r.id && (
              <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 p-2 text-xs">
                <span className="text-gold">סיסמה זמנית:</span>
                <code dir="ltr" className="rounded bg-bg px-1.5 py-0.5 font-bold text-white">{temp.pw}</code>
                <button onClick={() => navigator.clipboard?.writeText(temp.pw)} className="text-gray-400 hover:text-white">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <span className="text-gray-500">מסור למשתמש ובקש שיחליף מיד.</span>
              </div>
            )}

            {r.status === "open" && (
              <div className="flex gap-2">
                <button onClick={() => setStatus(r.id, "handled")} disabled={busy === r.id} className="btn-ghost text-xs">
                  <Check className="h-3.5 w-3.5" /> סמן כטופל
                </button>
                <button onClick={() => setStatus(r.id, "rejected")} disabled={busy === r.id} className="rounded-lg px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10">
                  <X className="me-1 inline h-3.5 w-3.5" /> דחה
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
