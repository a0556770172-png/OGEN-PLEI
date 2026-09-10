"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Loader2, Bot, User as UserIcon, ShieldQuestion, CheckCircle2, LifeBuoy, X, Lock } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "היי, אני עוזר איפוס הסיסמה. אני יכול לעזור רק בדבר אחד - להחזיר לך גישה לחשבון דרך שאלת האבטחה שהגדרת. מה כתובת המייל שאיתה נרשמת?";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetAssistant() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [email, setEmail] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyErr, setVerifyErr] = useState("");
  const [done, setDone] = useState(false);
  const [checkingQ, setCheckingQ] = useState(false);

  const [showEscalate, setShowEscalate] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, question, done]);

  async function checkQuestion(mail: string) {
    setCheckingQ(true);
    try {
      const res = await fetch("/api/auth/reset-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mail })
      });
      const j = await res.json().catch(() => ({}));
      if (j.hasQuestion && j.question) {
        setEmail(mail);
        setQuestion(j.question);
        setVerifyErr("");
      } else if (j.locked) {
        setMessages((m) => [...m, { role: "assistant", content: j.error || "החשבון נעול זמנית עקב ניסיונות שגויים. נסה שוב בעוד שעה או פנה לצוות." }]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "לא מצאתי שאלת אבטחה לחשבון הזה (ייתכן שהמייל שגוי, או שלא הגדרת שאלת אבטחה). אם יש לך גישה לחשבון ממכשיר אחר - הגדר שם שאלת אבטחה בעמוד הפרופיל. אחרת, פנה לצוות."
          }
        ]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "שגיאת רשת, נסה שוב." }]);
    } finally {
      setCheckingQ(false);
    }
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);

    // אם המשתמש שלח כתובת מייל - נבדוק ישירות אם יש לו שאלת אבטחה (בלי לבזבז קריאת AI)
    const mail = msg.match(EMAIL_RE)?.[0]?.toLowerCase();
    if (mail && !question) {
      await checkQuestion(mail);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/auth/reset-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const j = await res.json().catch(() => ({}));
      setMessages((m) => [...m, { role: "assistant", content: j.reply || "נסה שוב בבקשה." }]);
      if (j.detectedEmail && EMAIL_RE.test(j.detectedEmail) && !question) await checkQuestion(j.detectedEmail);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "שגיאת רשת, נסה שוב." }]);
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    setVerifyErr("");
    if (answer.trim().length < 1) return setVerifyErr("הזן תשובה");
    if (pw.length < 6) return setVerifyErr("הסיסמה החדשה - לפחות 6 תווים");
    if (pw !== pw2) return setVerifyErr("הסיסמאות אינן תואמות");
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/reset-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, answer, password: pw })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setMessages((m) => [...m, { role: "assistant", content: j.message || "הסיסמה עודכנה!" }]);
      } else {
        setVerifyErr(j.error || "לא הצלחנו לאמת");
        if (j.locked) setQuestion(null);
      }
    } catch {
      setVerifyErr("שגיאת רשת");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex h-[62vh] min-h-[460px] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-1 pe-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                m.role === "user" ? "bg-surface2 text-gray-300" : "bg-gradient-to-br from-primary to-accent text-[#fff]"
              }`}
            >
              {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "user" ? "bg-primary text-[#fff]" : "border border-border bg-surface text-gray-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {(sending || checkingQ) && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-xs text-gray-500">
              <Loader2 className="inline h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {question && !done && (
          <div className="w-full rounded-xl border border-primary/40 bg-primary/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-light">
              <ShieldQuestion className="h-4 w-4" /> שאלת האבטחה שלך
            </p>
            <p className="mt-1 text-sm font-bold text-white">{question}</p>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="התשובה (רישיות ורווחים לא משנים)"
              className="input-field mt-2 text-sm"
            />
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="סיסמה חדשה"
                className="input-field text-sm"
              />
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="אימות סיסמה"
                className="input-field text-sm"
              />
            </div>
            {verifyErr && <p className="mt-1.5 text-xs text-red-400">{verifyErr}</p>}
            <button onClick={verify} disabled={verifying} className="btn-primary mt-2 w-full justify-center text-sm">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} אימות ואיפוס סיסמה
            </button>
          </div>
        )}

        {done && (
          <div className="w-full rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
            <CheckCircle2 className="me-1 inline h-4 w-4" /> הסיסמה עודכנה!{" "}
            <Link href="/login" className="font-bold underline">
              לכניסה
            </Link>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <button
          onClick={() => setShowEscalate(true)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-white"
        >
          <LifeBuoy className="h-3.5 w-3.5" /> אין לי שאלת אבטחה / לא זוכר - פנייה לצוות
        </button>
        <Link href="/login" className="text-xs text-gray-500 hover:text-white">
          חזרה לכניסה
        </Link>
      </div>

      {!done && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-2 flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="כתוב כאן…"
            className="input-field max-h-32 flex-1 resize-none"
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn-primary shrink-0 !px-3.5">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}

      {showEscalate && <EscalateModal onClose={() => setShowEscalate(false)} />}
    </div>
  );
}

function EscalateModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (!email.trim() && !username.trim()) {
      setMsg("צריך לפחות מייל או שם משתמש");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/reset-escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, details })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setMsg(j.message || "נשלח לצוות.");
      } else {
        setMsg(j.error || "שגיאה");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-black text-white">פנייה לצוות - איפוס סיסמה</span>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {done ? (
          <p className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{msg}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">
              מלא כמה שיותר פרטים כדי שנוכל לזהות אותך. הצוות יבדוק ידנית ויחזור אליך.
            </p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              placeholder="המייל שנרשמת בו (אם ידוע)"
              className="input-field text-sm"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="שם המשתמש שלך באתר"
              className="input-field text-sm"
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="פרטים שיעזרו לזהות אותך: אפליקציות שהעלית, מתי בערך הצטרפת, קישור למתמחים טופ, כמה חברים הזמנת..."
              className="input-field resize-none text-sm"
            />
            {msg && <p className="text-xs text-red-400">{msg}</p>}
            <button onClick={submit} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "שליחת הפנייה"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
