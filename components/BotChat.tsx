"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Bot, User as UserIcon, AlertCircle, ThumbsUp, ThumbsDown, Mic, Check, X, Sparkles, Download, ArrowLeft, ChevronDown } from "lucide-react";
import BotMessageBody from "./BotMessageBody";
import BotAppCard, { type BotAppCardData } from "./BotAppCard";
import BotPersonaPicker from "./BotPersonaPicker";
import AdInterstitial from "./AdInterstitial";
import { getPersona, DEFAULT_PERSONA_ID } from "@/lib/botPersonas";
import { shouldShowAd } from "@/lib/adThrottle";

const PERSONA_KEY = "ogen-bot-persona";

interface ProposedAction {
  kind: "support_ticket" | "app_suggestion";
  summary: string;
  payload: Record<string, any>;
}
interface ClientAction {
  kind: "navigate" | "download";
  url?: string;
  appId?: string;
  label: string;
  auto?: boolean;
}
interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  appCards?: BotAppCardData[];
  followUps?: string[];
  proposedAction?: ProposedAction | null;
  clientAction?: ClientAction | null;
  feedback?: 1 | -1 | null;
  actionDone?: string;
}

const SUGGESTIONS = [
  "יש אפליקציה שעובדת אופליין לרשימת קניות?",
  "איפה אני עומד מבחינת מוניטין?",
  "המלץ לי על אפליקציות",
  "איך מזמינים חברים?"
];

export default function BotChat({
  variant = "page",
  conversationId = null,
  onConversationChange,
  onNavigate,
  autoSend = null,
  readOnly = false
}: {
  variant?: "widget" | "page";
  conversationId?: string | null;
  onConversationChange?: (id: string) => void;
  onNavigate?: () => void;
  autoSend?: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const autoSentRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [listening, setListening] = useState(false);
  const [opener, setOpener] = useState<{ text: string; followUps: string[] } | null>(null);
  const [persona, setPersona] = useState<string>(DEFAULT_PERSONA_ID);
  const [personaChosen, setPersonaChosen] = useState(true); // עד שנקרא מ-localStorage - לא מציגים בורר
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  // קריאת סגנון העוזר שנשמר. אין ערך שמור -> נציג את בורר הסגנון בשיחה חדשה.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERSONA_KEY);
      if (saved) {
        setPersona(saved);
        setPersonaChosen(true);
      } else {
        setPersonaChosen(false);
      }
    } catch {
      setPersonaChosen(true);
    }
  }, []);

  function choosePersona(id: string) {
    setPersona(id);
    setPersonaChosen(true);
    setShowPicker(false);
    try {
      localStorage.setItem(PERSONA_KEY, id);
    } catch {
      // ignore
    }
  }

  // הודעת פתיחה יזומה - רק בשיחה חדשה, לא ב-readOnly.
  useEffect(() => {
    if (readOnly || conversationId || messages.length > 0) return;
    let active = true;
    fetch("/api/bot/opener")
      .then((r) => r.json())
      .then((j) => active && j.opener && setOpener({ text: j.opener, followUps: j.followUps ?? [] }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [conversationId, readOnly, messages.length]);

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
        setMessages(
          (json.messages ?? []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            appCards: m.meta?.appCards ?? [],
            followUps: m.meta?.followUps ?? [],
            proposedAction: m.meta?.proposedAction ?? null,
            clientAction: m.meta?.clientAction ? { ...m.meta.clientAction, auto: false } : null
          }))
        );
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

  // שליחה אוטומטית של שאלה שהגיעה מה-peek של הווידג'ט (פעם אחת לכל ערך).
  useEffect(() => {
    if (autoSend && autoSend !== autoSentRef.current && !conversationId && messages.length === 0 && !sending) {
      autoSentRef.current = autoSend;
      send(autoSend);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, conversationId, messages.length, sending]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;
    setError("");
    setInput("");
    setOpener(null);
    setMessages((m) => [...m.map((x) => ({ ...x, followUps: [] })), { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: msg, personaId: persona })
      });
      const json = await res.json();
      if (!res.ok) {
        setError([json.error || "שגיאה בשליחת ההודעה", json.detail].filter(Boolean).join(" — "));
        setMessages((m) => m.slice(0, -1));
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: json.messageId,
          role: "assistant",
          content: json.reply,
          appCards: json.appCards ?? [],
          followUps: json.followUps ?? [],
          proposedAction: json.proposedAction ?? null,
          clientAction: json.clientAction ?? null,
          feedback: null
        }
      ]);
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

  async function rate(msgId: string | undefined, rating: 1 | -1) {
    if (!msgId) return;
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, feedback: rating } : x)));
    fetch("/api/bot/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msgId, rating })
    }).catch(() => {});
  }

  function doNavigate(url: string) {
    onNavigate?.();
    router.push(url);
  }

  async function runDownload(appId: string, msgId?: string) {
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionDone: "מתחיל הורדה…" } : x)));
    try {
      const res = await fetch(`/api/download/${appId}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionDone: json.error || "ההורדה נכשלה" } : x)));
        return;
      }
      window.location.href = json.url;
      setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionDone: "ההורדה החלה ✓" } : x)));
    } catch {
      setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionDone: "שגיאת רשת בהורדה" } : x)));
    }
  }

  // "פרסומת" קצרה של 3 שניות לפני שהורדה שיזם הבוט מתחילה בפועל - עד 3 פעמים ביום.
  const [adTarget, setAdTarget] = useState<{ appId: string; msgId?: string } | null>(null);
  function doDownload(appId: string, msgId?: string) {
    if (shouldShowAd()) setAdTarget({ appId, msgId });
    else runDownload(appId, msgId);
  }

  async function confirmAction(msg: Msg) {
    if (!msg.proposedAction || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch("/api/bot/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msg.id, action: msg.proposedAction })
      });
      const json = await res.json();
      setMessages((m) =>
        m.map((x) =>
          x.id === msg.id
            ? { ...x, proposedAction: null, actionDone: res.ok ? json.done : json.error || "הפעולה נכשלה" }
            : x
        )
      );
    } catch {
      setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, actionDone: "שגיאת רשת" } : x)));
    } finally {
      setBusyAction(false);
    }
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("הדפדפן לא תומך בהקלדה קולית");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "he-IL";
    rec.interimResults = false;
    rec.onresult = (e: any) => setInput((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
  const lastAssistant = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;
  const heightClass = variant === "widget" ? "h-[58vh] max-h-[520px]" : "h-[calc(100vh-17rem)] min-h-[420px]";
  const currentPersona = getPersona(persona);
  const showPersonaGate = !readOnly && !personaChosen && !conversationId && messages.length === 0 && !sending && !autoSend;

  return (
    <div className={`relative flex flex-col ${heightClass}`}>
      {!readOnly && personaChosen && !showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          title="שינוי סגנון העוזר"
          className="mb-1.5 inline-flex w-fit items-center gap-1.5 self-start rounded-full border border-border bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-gray-400 transition hover:border-primary/40 hover:text-white"
        >
          <span className="text-sm leading-none">{currentPersona.emoji}</span> {currentPersona.name}
          <ChevronDown className="h-3 w-3" />
        </button>
      )}

      {showPicker && (
        <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto rounded-xl border border-border bg-bg/98 p-3 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-black text-white">סגנון העוזר</span>
            <button onClick={() => setShowPicker(false)} className="rounded-md p-1 text-gray-500 transition hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <BotPersonaPicker value={persona} onPick={choosePersona} compact />
        </div>
      )}

      {adTarget && (
        <AdInterstitial
          onDone={() => {
            const t = adTarget;
            setAdTarget(null);
            runDownload(t.appId, t.msgId);
          }}
        />
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-1 pe-2">
        {showPersonaGate && (
          <div className="flex h-full flex-col justify-center py-2">
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow">
                <Bot className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">לפני שמתחילים —</p>
            </div>
            <BotPersonaPicker
              value={persona}
              onPick={choosePersona}
              onSkip={() => choosePersona(DEFAULT_PERSONA_ID)}
            />
          </div>
        )}

        {!showPersonaGate && messages.length === 0 && !sending && opener && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-sm text-gray-200">
                  <BotMessageBody text={opener.text} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {opener.followUps.map((f) => (
                    <button
                      key={f}
                      onClick={() => send(f)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary-light transition hover:bg-primary/15"
                    >
                      <Sparkles className="h-3 w-3" /> {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!showPersonaGate && messages.length === 0 && !sending && !opener && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <p className="font-black text-white">עוזר עוגן פליי</p>
              <p className="mt-1 text-sm text-gray-400">שאלו אותי כל דבר על האתר, בקשו שאמצא אפליקציה לפי דרישות, או תשאלו איפה אתם עומדים.</p>
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
            <div className={`flex min-w-0 max-w-[85%] flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === "user" ? "bg-primary text-[#fff]" : "border border-border bg-surface text-gray-200"
                }`}
              >
                {m.role === "assistant" ? <BotMessageBody text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>

              {/* כרטיסי אפליקציה */}
              {m.appCards && m.appCards.length > 0 && (
                <div className="flex w-full flex-col gap-1.5">
                  {m.appCards.slice(0, 6).map((c) => (
                    <BotAppCard key={c.id} app={c} />
                  ))}
                </div>
              )}

              {/* פעולת לקוח - ניווט / הורדה (עם auto אופציונלי) */}
              {m.clientAction && !readOnly && !m.actionDone && (
                <ClientActionCard
                  action={m.clientAction}
                  onNavigate={() => doNavigate(m.clientAction!.url!)}
                  onDownload={() => doDownload(m.clientAction!.appId!, m.id)}
                />
              )}

              {/* פעולה מוצעת - כרטיס אישור */}
              {m.proposedAction && !readOnly && (
                <div className="w-full rounded-xl border border-gold/40 bg-gold/10 p-3">
                  <p className="text-xs font-bold text-gold">{m.proposedAction.summary}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => confirmAction(m)}
                      disabled={busyAction}
                      className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-black text-[#111] transition hover:bg-gold/90"
                    >
                      {busyAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} אישור
                    </button>
                    <button
                      onClick={() => setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, proposedAction: null } : x)))}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" /> ביטול
                    </button>
                  </div>
                </div>
              )}
              {m.actionDone && (
                <p className="text-xs font-semibold text-accent">✓ {m.actionDone}</p>
              )}

              {/* דירוג + הצעות המשך (רק להודעת הבוט האחרונה) */}
              {m.role === "assistant" && !readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => rate(m.id, 1)}
                    className={`rounded-md p-1 transition ${m.feedback === 1 ? "text-accent" : "text-gray-600 hover:text-gray-300"}`}
                    title="תשובה טובה"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => rate(m.id, -1)}
                    className={`rounded-md p-1 transition ${m.feedback === -1 ? "text-red-400" : "text-gray-600 hover:text-gray-300"}`}
                    title="לא עזר"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {i === lastAssistant && !readOnly && m.followUps && m.followUps.length > 0 && !sending && (
                <div className="flex flex-wrap gap-1.5">
                  {m.followUps.map((f) => (
                    <button
                      key={f}
                      onClick={() => send(f)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary-light transition hover:bg-primary/15"
                    >
                      <Sparkles className="h-3 w-3" /> {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-4 py-3 text-xs text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> חושב ובודק במאגר…
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
          <button
            type="button"
            onClick={toggleVoice}
            title="הקלדה קולית"
            className={`shrink-0 rounded-xl border p-2.5 transition ${
              listening ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-border bg-surface2 text-gray-400 hover:text-white"
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
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
            placeholder={listening ? "מקשיב…" : "כתבו שאלה…"}
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

function ClientActionCard({
  action,
  onNavigate,
  onDownload
}: {
  action: ClientAction;
  onNavigate: () => void;
  onDownload: () => void;
}) {
  const [countdown, setCountdown] = useState(action.auto ? 3 : -1);
  const [fired, setFired] = useState(false);
  const Icon = action.kind === "download" ? Download : ArrowLeft;

  function fire() {
    setFired(true);
    if (action.kind === "download") onDownload();
    else onNavigate();
  }

  useEffect(() => {
    if (countdown < 0 || fired) return;
    if (countdown === 0) {
      fire();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, fired]);

  if (fired) return null;

  return (
    <div className="w-full rounded-xl border border-primary/40 bg-primary/10 p-3">
      {countdown > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-primary-light">
            <Icon className="me-1 inline h-3.5 w-3.5" /> {action.label} — בעוד {countdown}…
          </span>
          <button
            onClick={() => setCountdown(-1)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-bold text-gray-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> ביטול
          </button>
        </div>
      ) : (
        <button
          onClick={fire}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-black text-[#fff] transition hover:bg-primary-light"
        >
          <Icon className="h-4 w-4" /> {action.label}
        </button>
      )}
    </div>
  );
}
