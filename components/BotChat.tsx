"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot, User as UserIcon, AlertCircle } from "lucide-react";
import BotMessageBody from "./BotMessageBody";

interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "איך צוברים מוניטין באתר?",
  "יש אפליקציה שעובדת אופליין לרשימת קניות?",
  "מה ההבדל בין העלאה פרטית להצעה ציבורית?",
  "איך מגיעים לחשבון PRO?"
];

export default function BotChat({
  variant = "page",
  conversationId = null,
  onConversationChange,
  readOnly = false
}: {
  variant?: "widget" | "page";
  conversationId?: string | null;
  onConversationChange?: (id: string) => void;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // טעינת היסטוריית שיחה קיימת (או ניקוי כשמתחילים שיחה חדשה).
  useEffect(() => {
    if (!conversationId) {
      if (loadedId !== null) {
        setMessages([]);
        setLoadedId(null);
      }
      return;
    }
    if (conversationId === loadedId) return;
    let active = true;
    setError("");
    fetch(`/api/bot/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        setMessages((json.messages ?? []).map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
        setLoadedId(conversationId);
      })
      .catch(() => active && setError("שגיאה בטעינת השיחה"));
    return () => {
      active = false;
    };
  }, [conversationId, loadedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: msg })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "שגיאה בשליחת ההודעה");
        setMessages((m) => m.slice(0, -1)); // מסירים את ההודעה שנכשלה
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
      if (json.conversationId && json.conversationId !== conversationId) {
        setLoadedId(json.conversationId);
        onConversationChange?.(json.conversationId);
      }
    } catch {
      setError("שגיאת רשת - נסו שוב");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  const heightClass = variant === "widget" ? "h-[60vh] max-h-[520px]" : "h-[calc(100vh-16rem)] min-h-[420px]";

  return (
    <div className={`flex flex-col ${heightClass}`}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-1 pe-2">
        {messages.length === 0 && !sending && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <p className="font-black text-white">עוזר עוגן פליי</p>
              <p className="mt-1 text-sm text-gray-400">שאלו אותי על האתר, על מוניטין, או בקשו שאמצא לכם אפליקציה מהמאגר.</p>
            </div>
            {!readOnly && (
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-surface2 px-3 py-1.5 text-xs text-gray-300 transition hover:border-primary/50 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={m.id ?? i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                m.role === "user" ? "bg-surface2 text-gray-300" : "bg-gradient-to-br from-primary to-accent text-[#fff]"
              }`}
            >
              {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "user" ? "bg-primary text-[#fff]" : "border border-border bg-surface text-gray-200"
              }`}
            >
              {m.role === "assistant" ? <BotMessageBody text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border bg-surface px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-1 mt-2 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      {readOnly ? (
        <p className="mt-2 px-1 text-center text-xs text-gray-500">תצוגת צוות - שיחה של משתמש (קריאה בלבד)</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-3 flex items-end gap-2"
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
            placeholder="כתבו שאלה..."
            className="input-field max-h-32 flex-1 resize-none"
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn-primary shrink-0 !px-3.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      )}
    </div>
  );
}
