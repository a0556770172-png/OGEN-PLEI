"use client";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Check, Pencil, Trash2, ShieldQuestion } from "lucide-react";

const SUGGESTIONS = [
  "שם החיה הראשונה שהייתה לי",
  "העיר שבה נולדתי",
  "שם הרחוב שגדלתי בו",
  "שם המלמד/המורה בכיתה א'",
  "השם הפרטי של סבא רבא שלי",
  "שם הישיבה/בית הספר הראשון שלי"
];

export default function SecurityQuestion() {
  const [loading, setLoading] = useState(true);
  const [hasQuestion, setHasQuestion] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function load() {
    fetch("/api/profile/security-question")
      .then((r) => r.json())
      .then((j) => {
        setHasQuestion(!!j.hasQuestion);
        setCurrentQuestion(j.question ?? null);
        if (j.question) setQuestion(j.question);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function save() {
    setErr("");
    if (question.trim().length < 5) return setErr("כתוב שאלה");
    if (answer.trim().length < 2) return setErr("כתוב תשובה");
    setBusy(true);
    try {
      const res = await fetch("/api/profile/security-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "שגיאה");
        return;
      }
      setAnswer("");
      setEditing(false);
      setMsg("נשמר");
      setTimeout(() => setMsg(""), 2000);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("להסיר את שאלת האבטחה? בלעדיה, אם תשכח את הסיסמה תצטרך לפנות לצוות.")) return;
    setBusy(true);
    await fetch("/api/profile/security-question", { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setQuestion("");
    setAnswer("");
    load();
  }

  if (loading) {
    return (
      <div className="card flex w-full justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`card flex w-full flex-col gap-3 p-6 ${!hasQuestion ? "border-gold/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            hasQuestion ? "bg-primary/15 text-primary-light" : "bg-gold/15 text-gold"
          }`}
        >
          <ShieldQuestion className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="flex items-center gap-2 font-bold text-white">
            שאלת אבטחה לאיפוס סיסמה
            {!hasQuestion && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-black text-gold">מומלץ</span>
            )}
          </p>
          <p className="text-sm text-gray-400">
            {hasQuestion
              ? "אם תשכח את הסיסמה, תוכל לאפס אותה בעצמך ע\"י מענה על השאלה - בלי מייל ובלי לחכות לצוות."
              : "בלי שאלת אבטחה, אם תשכח את הסיסמה תצטרך לפנות לצוות. מומלץ להגדיר עכשיו."}
          </p>
        </div>
      </div>

      {hasQuestion && !editing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface2/50 p-3">
          <KeyRound className="h-4 w-4 shrink-0 text-primary-light" />
          <span className="flex-1 text-sm text-gray-200">{currentQuestion}</span>
          <button onClick={() => { setEditing(true); setAnswer(""); }} className="btn-ghost text-xs">
            <Pencil className="h-3.5 w-3.5" /> שינוי
          </button>
          <button onClick={remove} disabled={busy} className="rounded-lg px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10">
            <Trash2 className="me-1 inline h-3.5 w-3.5" /> הסרה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            list="sec-q-suggestions"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
            placeholder="השאלה (בחר מהרשימה או כתוב משלך)"
            className="input-field text-sm"
          />
          <datalist id="sec-q-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={200}
            placeholder="התשובה (זכור אותה בדיוק - רישיות ורווחים לא משנים)"
            className="input-field text-sm"
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} שמירה
            </button>
            {editing && (
              <button onClick={() => setEditing(false)} className="btn-ghost text-sm text-gray-400">
                ביטול
              </button>
            )}
            {msg && <span className="self-center text-xs text-accent">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
