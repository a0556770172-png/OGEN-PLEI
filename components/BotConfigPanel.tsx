"use client";
import { useEffect, useState } from "react";
import { Bot, Loader2, Save, Search, MessageSquare, ArrowRight, Plug, CheckCircle2, AlertCircle, Wrench, ThumbsUp, ThumbsDown, ShieldAlert, ChevronDown, Circle, CheckCheck, Square, CheckSquare } from "lucide-react";
import BotChat from "./BotChat";
import BotKeysManager from "./BotKeysManager";

interface Config {
  enabled: boolean;
  model: string;
  modelSmart: string;
  systemPrompt: string;
  dailyLimit: number;
  proactiveEnabled: boolean;
  maxToolRounds: number;
  hasKey: boolean;
  fallbackModel?: string | null;
  fallbackUntil?: string | null;
}

interface Insights {
  conversationsTotal: number;
  questionsTotal: number;
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
  flagged_at?: string | null;
  interest_score?: number | null;
  interest_note?: string | null;
  staff_reviewed_at?: string | null;
  user?: { username: string };
}

interface Detection {
  id: string;
  at: string;
  username: string;
  userId: string | null;
  reason: string;
  sample: string | null;
  conversationId: string | null;
  conversationExists: boolean;
}

export default function BotConfigPanel() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [q, setQ] = useState("");
  const [convSort, setConvSort] = useState<"recent" | "interest">("interest");
  const [scoring, setScoring] = useState(false);
  const [viewId, setViewIdRaw] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detections, setDetections] = useState<Detection[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string; models: string[] } | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/bot-config/test", { method: "POST" });
      const j = await res.json();
      const lines = (j.results ?? []).map((r: any) => `${r.ok ? "✓" : "✗"} ${r.label}: ${r.detail}`);
      if (j.ok) {
        setTestResult({
          ok: true,
          text: `יש חיבור תקין!\n${lines.join("\n")}`,
          models: j.availableModels ?? []
        });
      } else {
        setTestResult({
          ok: false,
          text: `אף מפתח לא עבד:\n${lines.length ? lines.join("\n") : j.error || "הבדיקה נכשלה"}`,
          models: j.availableModels ?? []
        });
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
          hasKey: j.hasKey,
          fallbackModel: j.fallbackModel ?? null,
          fallbackUntil: j.fallbackUntil ?? null
        })
      )
      .catch(() => {});
    fetch("/api/admin/bot-insights")
      .then((r) => r.json())
      .then((j) => setInsights(j))
      .catch(() => {});
  }, []);

  function loadConvs() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (convSort === "interest") params.set("sort", "interest");
    fetch(`/api/admin/bot-conversations${params.toString() ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((j) => setConvs(j.conversations ?? []))
      .catch(() => {});
  }

  async function markReviewed(body: { ids?: string[]; all?: boolean; reviewed?: boolean }) {
    const now = new Date().toISOString();
    const val = body.reviewed === false ? null : now;
    setConvs((cs) =>
      cs.map((c) =>
        body.all || (body.ids ?? []).includes(c.id) ? { ...c, staff_reviewed_at: val } : c
      )
    );
    await fetch("/api/admin/bot-conversations/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  function setViewId(id: string | null) {
    setViewIdRaw(id);
    if (id) {
      const c = convs.find((x) => x.id === id);
      if (c && !c.staff_reviewed_at) markReviewed({ ids: [id] });
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  async function scoreConvs(manual = false) {
    setScoring(true);
    try {
      const res = await fetch("/api/admin/bot-score-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: manual ? 20 : 10 })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j.scored ?? 0) > 0) loadConvs();
      if (manual) setMsg(res.ok ? `דורגו ${j.scored ?? 0} שיחות` : j.error || "שגיאה בדירוג");
    } finally {
      setScoring(false);
      if (manual) setTimeout(() => setMsg(""), 2500);
    }
  }

  useEffect(() => {
    loadConvs();
    fetch("/api/admin/bot-flagged")
      .then((r) => r.json())
      .then((j) => setDetections(j.detections ?? []))
      .catch(() => {});
    // דירוג רקע קטן של שיחות שלא דורגו - כדי שהרשימה "לפי עניין" תתמלא עם הזמן
    scoreConvs(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convSort]);

  async function save(partial: Partial<Config> & { clearFallback?: boolean }) {
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
      const clearsFallback = partial.clearFallback || typeof partial.model === "string";
      setCfg({ ...cfg, ...partial, ...(clearsFallback ? { fallbackModel: null, fallbackUntil: null } : {}) });
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
          {!cfg.hasKey && <span className="text-xs text-gold">(צריך גם מפתח API אחד לפחות)</span>}
        </div>

        <div className="border-t border-border pt-4">
          <BotKeysManager />
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
            <p className="mt-1 text-xs text-gray-500">אם המודל לא קיים או עמוס - עוברים אוטומטית למודל זמין אחר, וחוזרים לבדוק את המועדף אחרי כ-20 דק'.</p>
            {cfg.fallbackModel && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  כרגע פועל זמנית על <b dir="ltr">{cfg.fallbackModel}</b>
                  {cfg.fallbackUntil ? ` (בדיקה חוזרת של המועדף בסביבות ${new Date(cfg.fallbackUntil).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })})` : ""}.
                </span>
                <button
                  onClick={() => save({ clearFallback: true })}
                  className="rounded-md border border-gold/40 px-2 py-0.5 font-bold transition hover:bg-gold/20"
                >
                  חזור עכשיו למועדף
                </button>
              </div>
            )}
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
            <Wrench className="h-5 w-5 text-primary-light" /> תובנות
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center">
              <span className="block text-xl font-black text-white">{(insights.conversationsTotal ?? 0).toLocaleString("he-IL")}</span>
              <span className="text-[11px] text-gray-400">שיחות שבוצעו עם הבוט</span>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center">
              <span className="block text-xl font-black text-white">{(insights.questionsTotal ?? 0).toLocaleString("he-IL")}</span>
              <span className="text-[11px] text-gray-400">שאלות ששאלו את הבוט</span>
            </div>
            <div className="rounded-xl border border-border bg-surface2/60 p-3 text-center">
              <span className="block text-xl font-black text-white">{insights.toolCallsTotal.toLocaleString("he-IL")}</span>
              <span className="text-[11px] text-gray-500">קריאות כלים (30 יום)</span>
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
          <ShieldAlert className="h-5 w-5 text-red-400" /> שיחות חשודות שהבוט זיהה
          {detections.length > 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">
              {detections.length}
            </span>
          )}
        </div>
        <p className="-mt-1 text-xs text-gray-500">
          ניסיונות להוליך את הבוט לשיחה לא לגיטימית (jailbreak / חילוץ הוראות / הסטה מכוונת). כל זיהוי חוסם את
          המשתמש מהבוט לשעה ומתעד כאן - כולל כל מה שזוהה בעבר.
        </p>
        <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
          {detections.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">לא זוהו ניסיונות חשודים.</p>
          ) : (
            detections.map((d) => (
              <div key={d.id} className="bg-surface2/40 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {d.userId ? (
                    <a href={`/users/${d.userId}`} target="_blank" rel="noreferrer" className="font-bold text-white hover:underline">
                      {d.username}
                    </a>
                  ) : (
                    <span className="font-bold text-white">{d.username}</span>
                  )}
                  <span className="text-xs text-gray-600">
                    {new Date(d.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-xs text-red-400">{d.reason}</span>
                </div>
                {d.sample && (
                  <button
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="mt-1 flex w-full items-start gap-1 text-right text-xs text-gray-400 hover:text-gray-200"
                  >
                    <ChevronDown className={`mt-0.5 h-3.5 w-3.5 shrink-0 transition ${expanded === d.id ? "rotate-180" : ""}`} />
                    <span className={expanded === d.id ? "whitespace-pre-wrap" : "line-clamp-1"}>{d.sample}</span>
                  </button>
                )}
                {d.conversationId && d.conversationExists && (
                  <button
                    onClick={() => setViewId(d.conversationId)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-surface2 px-2.5 py-1 text-xs font-bold text-primary-light transition hover:bg-primary/15"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> פתיחת השיחה המלאה
                  </button>
                )}
                {d.conversationId && !d.conversationExists && (
                  <span className="mt-1 block text-[11px] text-gray-600">השיחה נמחקה - נשמר רק הטקסט שלמעלה.</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <MessageSquare className="h-5 w-5 text-primary-light" /> שיחות של משתמשים עם הבוט
          </div>
          <button
            onClick={() => scoreConvs(true)}
            disabled={scoring}
            className="btn-ghost text-xs"
            title="ה-AI יעבור על שיחות שלא דורגו ויתן להן ציון עניין 1-10"
          >
            {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />} דרג שיחות
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(["interest", "recent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setConvSort(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                convSort === s ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"
              }`}
            >
              {s === "interest" ? "הכי מעניינות" : "האחרונות"}
            </button>
          ))}
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

        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 ? (
            <>
              <span className="text-xs font-bold text-primary-light">{selected.size} נבחרו</span>
              <button
                onClick={() => { markReviewed({ ids: [...selected], reviewed: true }); setSelected(new Set()); }}
                className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white"
              >
                <CheckCircle2 className="me-1 inline h-3.5 w-3.5" /> סמן כנקרא
              </button>
              <button
                onClick={() => { markReviewed({ ids: [...selected], reviewed: false }); setSelected(new Set()); }}
                className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white"
              >
                <Circle className="me-1 inline h-3.5 w-3.5" /> סמן כלא נקרא
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-white">
                נקה בחירה
              </button>
            </>
          ) : (
            <button
              onClick={() => confirm("לסמן את כל השיחות שלא נקראו כנקראו?") && markReviewed({ all: true, reviewed: true })}
              className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white"
            >
              <CheckCheck className="me-1 inline h-3.5 w-3.5" /> סמן הכל שקראתי
            </button>
          )}
        </div>

        <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
          {convs.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">אין שיחות</p>
          ) : (
            convs.map((c) => {
              const read = !!c.staff_reviewed_at;
              const sel = selected.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => setViewId(c.id)}
                  className={`flex cursor-pointer items-start gap-2 px-3 py-2.5 text-right text-sm transition hover:bg-surface2 ${
                    read ? "bg-surface2/20" : "bg-surface2/60"
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                    className="mt-0.5 shrink-0 text-gray-500 hover:text-white"
                    title="בחירה"
                  >
                    {sel ? <CheckSquare className="h-4 w-4 text-primary-light" /> : <Square className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); markReviewed({ ids: [c.id], reviewed: !read }); }}
                    className="mt-0.5 shrink-0"
                    title={read ? "קראתי - לחץ לסימון כלא נקרא" : "לא נקרא - לחץ לסימון כנקרא"}
                  >
                    {read ? (
                      <CheckCircle2 className="h-4 w-4 text-gray-600" />
                    ) : (
                      <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex min-w-0 flex-1 items-center gap-1.5 truncate ${read ? "text-gray-400" : "font-bold text-gray-100"}`}>
                        {c.flagged_at && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />}
                        {typeof c.interest_score === "number" && (
                          <span
                            className={`shrink-0 rounded px-1.5 text-[10px] font-black ${
                              c.interest_score >= 8
                                ? "bg-gold/20 text-gold"
                                : c.interest_score >= 4
                                ? "bg-primary/15 text-primary-light"
                                : "bg-surface2 text-gray-500"
                            }`}
                          >
                            {c.interest_score}
                          </span>
                        )}
                        {c.title}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">{c.user?.username ?? "—"}</span>
                      <span className="shrink-0 text-xs text-gray-600">{new Date(c.updated_at).toLocaleDateString("he-IL")}</span>
                    </div>
                    {c.interest_note && <span className="text-[11px] text-gray-500">{c.interest_note}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
