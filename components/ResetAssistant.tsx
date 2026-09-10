"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Loader2, Bot, User as UserIcon, Mail, CheckCircle2, LifeBuoy, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "היי, אני עוזר איפוס הסיסמה. אני יכול לעזור רק בדבר אחד - להחזיר לך גישה לחשבון. מה כתובת המייל שאיתה נרשמת?";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetAssistant() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [emailToSend, setEmailToSend] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, emailToSend, linkSent]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setSending(true);
    try {
      const res = await fetch("/api/auth/reset-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const j = await res.json().catch(() => ({}));
      setMessages((m) => [...m, { role: "assistant", content: j.reply || "נסה שוב בבקשה." }]);
      if (j.detectedEmail && EMAIL_RE.test(j.detectedEmail)) {
        setEmailToSend(j.detectedEmail);
        setLinkSent(false);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "שגיאת רשת, נסה שוב." }]);
    } finally {
      setSending(false);
    }
  }

  async function sendLink() {
    if (!emailToSend || sendingLink) return;
    setSendingLink(true);
    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend })
      });
      const j = await res.json().catch(() => ({}));
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.ok
            ? `${j.message}\n\nפתח את המייל, לחץ על הקישור, וקבע סיסמה חדשה. הקישור בתוקף לזמן מוגבל.`
            : j.error || "לא הצלחנו לשלוח כרגע."
        }
      ]);
      if (res.ok) setLinkSent(true);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "שגיאת רשת בשליחה." }]);
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="flex h-[60vh] min-h-[440px] flex-col">
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

        {sending && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-xs text-gray-500">
              <Loader2 className="inline h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {emailToSend && !linkSent && (
          <div className="mx-auto w-full rounded-xl border border-primary/40 bg-primary/10 p-3">
            <p className="text-xs font-bold text-primary-light">
              <Mail className="me-1 inline h-3.5 w-3.5" /> לשלוח קישור איפוס אל <b dir="ltr">{emailToSend}</b>?
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={sendLink} disabled={sendingLink} className="btn-primary text-xs">
                {sendingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} שליחת קישור
              </button>
              <button onClick={() => setEmailToSend(null)} className="btn-ghost text-xs text-gray-400">
                כתובת אחרת
              </button>
            </div>
          </div>
        )}

        {linkSent && (
          <div className="mx-auto w-full rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs text-accent">
            <CheckCircle2 className="me-1 inline h-3.5 w-3.5" /> הקישור נשלח אל {emailToSend}. לא הגיע? בדוק ספאם, חכה דקה ונסה שוב,
            או{" "}
            <button onClick={() => setShowEscalate(true)} className="font-bold underline">
              פנה לצוות
            </button>
            .
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <button
          onClick={() => setShowEscalate(true)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-white"
        >
          <LifeBuoy className="h-3.5 w-3.5" /> לא מצליח? פנייה לצוות
        </button>
        <Link href="/login" className="text-xs text-gray-500 hover:text-white">
          חזרה לכניסה
        </Link>
      </div>

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
