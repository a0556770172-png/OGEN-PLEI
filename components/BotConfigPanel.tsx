"use client";
import { useEffect, useState } from "react";
import { Bot, Loader2, Save, KeyRound, Search, MessageSquare, ArrowRight, Plug, CheckCircle2, AlertCircle, Wrench, ThumbsUp, ThumbsDown } from "lucide-react";
import BotChat from "./BotChat";

interface Config {
  enabled: boolean;
  model: string;
  modelSmart: string;
  systemPrompt: string;
  dailyLimit: number;
  proactiveEnabled: boolean;
  maxToolRounds: number;
  hasKey: boolean;
}

interface Insights {
  toolCallsTotal: number;
  topTools: { tool: string; total: number; failed: number }[];
  thumbsUp: number;
  thumbsDown: number;
  negatives: { note: string | null; at: string; excerpt: string; conversationId: string | null }[];
}

interface ConvRow {
  id: string;
  title: string;
  updated_at: string;
  user?: { username: string };
}

export default function BotConfigPanel() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string; models: string[] } | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/bot-config/test", { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        setTestResult({ ok: true, text: `חיבור תקין! מודל בשימוש: ${j.modelUsed}. תשובת בדיקה: "${j.reply}"`, models: j.availableModels ?? [] });
        if (cfg && j.modelUsed) setCfg({ ...cfg, model: j.modelUsed });
      } else {
        const raw = String(j.error || "הבדיקה נכשלה");
        let hint = raw;
        if (/suspended/i.test(raw)) {
          hint = "מפתח ה-API הושעה ע\"י Google. צור מפתח חדש ב-aistudio.google.com/app/apikey (עדיף בפרויקט חדש) והכנס אותו כאן. " + raw;
        } else if (/API_KEY_INVALID|API key not valid/i.test(raw)) {
          hint = "מפתח ה-API לא תקין. ודא שהעתקת אותו במלואו מ-aistudio.google.com/app/apikey. " + raw;
        } else if (/403|PERMISSION_DENIED/i.test(raw)) {
          hint = "אין הרשאה - ייתכן ש-Generative Language API לא מופעל בפרויקט, או שהמפתח מוגבל. " + raw;
        }
        setTestResult({ ok: false, text: hint, models: j.availableModels ?? [] });
      }
    } catch {
      setTestResult({ ok: false, text: "שגיאת רשת בבדיקה", models: [] });
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin/bot-config")
      .then((r) => r.json())
      .then((j) =>
        setCfg({
          enabled: j.enabled,
          model: j.model,
          modelSmart: j.modelSmart ?? "",
          systemPrompt: j.systemPrompt,
          dailyLimit: j.dailyLimit,
          proactiveEnabled: j.proactiveEnabled ?? true,
          maxToolRounds: j.maxToolRounds ?? 5,
          hasKey: j.hasKey
        })
      )
      .catch(() => {});
    fetch("/api/admin/bot-insights")
      .then((r) => r.json())
      .then((j) => setInsights(j))
      .catch(() => {});
  }, []);

  function loadConvs() {
    fetch(`/api/admin/bot-conversations${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)
      .then((r) => r.json())
      .then((j) => setConvs(j.conversations ?? []))
      .catch(() => {});
  }
  useEffect(() => {
    loadConvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(partial: Partial<Config> & { geminiApiKey?: string }) {
    if (!cfg) return;
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/bot-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial)
    });
    setSaving(false);
    if (res.ok) {
      setMsg("נשמר");
      setTimeout(() => setMsg(""), 1500);
      if (partial.geminiApiKey !== undefined) {
        setKeyInput("");
        setCfg({ ...cfg, ...partial, hasKey: !!partial.geminiApiKey || (partial.geminiApiKey === "" ? false : cfg.hasKey) });
      } else {
        setCfg({ ...cfg, ...partial });
      }
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "שגיאה בשמירה");
    }
  }

  if (!cfg) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (viewId) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setViewId(null)} className="btn-ghost self-start text-sm">
          <ArrowRight className="h-4 w-4" /> חזרה לרשימת השיחות
        </button>
        <div className="card p-4">
          <BotChat variant="page" conversationId={viewId} readOnly />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-white">
          <Bot className="h-5 w-5 text-primary-light" /> הגדרות הצ'אט-בוט (Gemini)
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => save({ enabled: !cfg.enabled })}
            disabled={saving}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${cfg.enabled ? "bg-primary" : "bg-surface2"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${cfg.enabled ? "right-1" : "right-7"}`} />
          </button>
          <span className={`text-sm font-bold ${cfg.enabled ? "text-primary-light" : "text-gray-400"}`}>
            {cfg.enabled ? "הבוט פעיל" : "הבוט כבוי"}
          </span>
          {!cfg.hasKey && <span className="text-xs text-gold">(צריך גם מפתח API כדי שיעבוד)</span>}
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400">
            <KeyRound className="h-4 w-4" /> מפתח Gemini API {cfg.hasKey && <span className="text-accent">— מוגדר ✓</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={cfg.hasKey ? "הזן מפתח חדש כדי להחליף" : "AIza..."}
              className="input-field flex-1"
              dir="ltr"
            />
            <button onClick={() => save({ geminiApiKey: keyInput })} disabled={saving || !keyInput.trim()} className="btn-primary shrink-0 text-sm">
              שמירה
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            מפיקים מפתח חינמי ב-<span dir="ltr">aistudio.google.com/app/apikey</span>. המפתח נשמר בשרת בלבד ואינו נחשף למשתמשים.
            {cfg.hasKey && (
              <>
                {" "}
                <button onClick={() => save({ geminiApiKey: "" })} className="text-red-400 hover:underline">מחיקת המפתח</button>
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">מודל ראשי</label>
            <input
              value={cfg.model}
              onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
              onBlur={() => save({ model: cfg.model })}
              className="input-field"
              dir="ltr"
              placeholder="gemini-2.5-flash"
            />
            <p className="mt-1 text-xs text-gray-500">אם המודל לא קיים - עוברים אוטומטית למודל זמין אחר.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">מודל חזק (עזרה למפתחים/ניסוח) — ריק = כמו הראשי</label>
            <input
              value={cfg.modelSmart}
              onChange={(e) => setCfg({ ...cfg, modelSmart: e.target.value })}
              onBlur={() => save({ modelSmart: cfg.modelSmart })}
              className="input-field"
              dir="ltr"
              placeholder="gemini-2.5-pro"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">מגבלת שאלות יומית למשתמש</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={cfg.dailyLimit}
              onChange={(e) => setCfg({ ...cfg, dailyLimit: Number(e.target.value) })}
              onBlur={() => save({ dailyLimit: cfg.dailyLimit })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">מקסימום סבבי כלים לשאלה (1–8)</label>
            <input
              type="number"
              min={1}
              max={8}
              value={cfg.maxToolRounds}
              onChange={(e) => setCfg({ ...cfg, maxToolRounds: Number(e.target.value) })}
              onBlur={() => save({ maxToolRounds: cfg.maxToolRounds })}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => save({ proactiveEnabled: !cfg.proactiveEnabled })}
            disabled={saving}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${cfg.proactiveEnabled ? "bg-primary" : "bg-surface2"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${cfg.proactiveEnabled ? "right-1" : "right-6"}`} />
          </button>
          <span className="text-sm text-gray-300">הודעות פתיחה יזומות (המלצות פרואקטיביות כשנפתחת חלונית)</span>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">הנחיית מערכת (אישיות הבוט) — ריק = ברירת מחדל</label>
          <textarea
            value={cfg.systemPrompt}
            onChange={(e) => setCfg({ ...cfg, systemPrompt: e.target.value })}
            rows={5}
            className="input-field resize-y"
            placeholder="ריק = הנחיית ברירת המחדל (עוזר עוגן פליי, עברית, נשאר בנושא האתר...)"
          />
          <button onClick={() => save({ systemPrompt: cfg.systemPrompt })} disabled={saving} className="btn-ghost mt-2 text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} שמירת ההנחיה
          </button>
        </div>

        {msg && <p className="text-sm text-accent">{msg}</p>}

        <div className="border-t border-border pt-4">
          <button onClick={runTest} disabled={testing || !cfg.hasKey} className="btn-ghost text-sm">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} בדיקת חיבור ל-Gemini
          </button>
          {testResult && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                testResult.ok ? "border-accent/30 bg-accent/10 text-accent" : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span className="whitespace-pre-wrap">{testResult.text}</span>
            </div>
          )}
          {testResult && testResult.models.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-gray-500">מודלים זמינים למפתח שלך (לחיצה בוחרת):</p>
              <div className="flex flex-wrap gap-1.5">
                {testResult.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => save({ model: m })}
                    dir="ltr"
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      cfg.model === m ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {insights && (
        <div className="card flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Wrench className="h-5 w-5 text-primary-light" /> תובנות (30 יום)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-surface2/60 p-3 text-center">
              <span className="block text-xl font-black text-white">{insights.toolCallsTotal}</span>
              <span className="text-[11px] text-gray-500">קריאות כלים</span>
            </div>
            <div className="rounded-xl border border-border bg-surface2/60 p-3 text-center">
              <span className="flex items-center justify-center gap-1 text-xl font-black text-accent"><ThumbsUp className="h-4 w-4" /> {insights.thumbsUp}</span>
              <span className="text-[11px] text-gray-500">דירוג חיובי</span>
            </div>
            <div className="rounded-xl border border-border bg-surface2/60 p-3 text-center">
              <span className="flex items-center justify-center gap-1 text-xl font-black text-red-400"><ThumbsDown className="h-4 w-4" /> {insights.thumbsDown}</span>
              <span className="text-[11px] text-gray-500">דירוג שלילי</span>
            </div>
          </div>

          {insights.topTools.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold text-gray-500">כלים בשימוש</p>
              <div className="flex flex-wrap gap-1.5">
                {insights.topTools.slice(0, 12).map((t) => (
                  <span key={t.tool} dir="ltr" className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] text-gray-300">
                    {t.tool} · {t.total}{t.failed ? ` (${t.failed} נכשלו)` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {insights.negatives.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold text-gray-500">תשובות שדורגו שלילי</p>
              <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
                {insights.negatives.map((n, idx) => (
                  <button
                    key={idx}
                    onClick={() => n.conversationId && setViewId(n.conversationId)}
                    className="bg-surface2/40 px-3 py-2 text-right text-xs text-gray-400 transition hover:bg-surface2"
                  >
                    <span className="line-clamp-2 text-gray-300">{n.excerpt}…</span>
                    {n.note && <span className="mt-0.5 block text-red-400">"{n.note}"</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-white">
          <MessageSquare className="h-5 w-5 text-primary-light" /> שיחות של משתמשים עם הבוט
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadConvs()}
            onBlur={loadConvs}
            placeholder="חיפוש לפי שם משתמש או נושא..."
            className="input-field w-full pe-10"
          />
        </div>
        <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
          {convs.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">אין שיחות</p>
          ) : (
            convs.map((c) => (
              <button
                key={c.id}
                onClick={() => setViewId(c.id)}
                className="flex items-center justify-between gap-2 bg-surface2/40 px-3 py-2.5 text-right text-sm transition hover:bg-surface2"
              >
                <span className="min-w-0 flex-1 truncate text-gray-200">{c.title}</span>
                <span className="shrink-0 text-xs text-gray-500">{c.user?.username ?? "—"}</span>
                <span className="shrink-0 text-xs text-gray-600">{new Date(c.updated_at).toLocaleDateString("he-IL")}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
