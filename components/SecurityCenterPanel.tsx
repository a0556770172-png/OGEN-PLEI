"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, Activity, Ban, Radar, Zap, Eye, X, Loader2, Gauge, Clock, Fingerprint, Globe, Check } from "lucide-react";

// מרכז בקרת אבטחה - נתונים בזמן אמת משירות ה-sentinel (deploy/sentinel). הלוח רק קורא דרך /api/admin/security/*,
// בשאילתות קלות, ומפסיק לשאול כשהלשונית מוסתרת - כך שאין לו שום השפעה על מהירות האתר לגולשים.

type Severity = "low" | "medium" | "high" | "critical";
interface SecEvent { id: number; ts: string; ip: string; type: string; severity: Severity; path: string | null; method: string | null; status: number | null; ua: string | null; details: any; count: number; blocked: boolean }
interface Attacker {
  ip: string; firstSeen: string; lastSeen: string; hits: number; score: number; types: string[]; typeCounts: Record<string, number>;
  profile: { label?: string; families?: string[]; tool?: string; top_paths?: string[]; samples?: { ts: number; type: string; path: string; status: number }[]; statuses?: Record<string, number>; user_agents?: string[] };
  blockedUntil: string | null; blockCount: number;
}
interface Summary {
  setup: boolean;
  settings: { mode: "observe" | "enforce"; block_score: number; whitelist: string[] };
  threat: "calm" | "elevated" | "high" | "critical";
  last10min: { critical: number; high: number; medium: number; blocks: number };
  kpis: { rpsNow: number; req5m: number; s5xx5m: number; r4295m: number; waf5m: number; blockedHits5m: number; authFail5m: number; p95ms: number; activeBlocks: number; attackers24h: number; events24h: number; high24h: number };
  series: { minute: string; req: number; s4xx: number; s5xx: number; r429: number; waf: number; blocked: number; ips: number; authFail: number; p95: number; avg: number }[];
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  hourly: { hoursAgo: number; low: number; medium: number; high: number; critical: number }[];
  topAttackers: Attacker[];
}
interface BlockEntry { ip: string; status: string; until: string | null; reason: string | null; source: string; note: string | null; updated_at: string }

const TYPE_LABEL: Record<string, string> = {
  scan: "סריקת תשתית / קבצים רגישים", exploit: "ניסיון חדירה (Path Traversal / LFI / Log4Shell)", sqli: "SQL Injection", xss: "XSS", cmdi: "הזרקת פקודות (RCE)",
  ssrf: "ניסיון SSRF", bad_ua: "כלי תקיפה מוכר", flood: "הצפת בקשות (HTTP Flood)", slow: "התקפה איטית (Slowloris)", brute: "ניחוש סיסמאות / Brute Force",
  admin_probe: "ניסיון הסלמת הרשאות", enum: "סריקת מזהים (IDOR)", recon404: "גילוי נתיבים", method: "שיטת HTTP חריגה", csrf: "חשד ל-CSRF", errors: "גרימת שגיאות שרת",
  volume: "עליית תנועה חריגה מבוזרת (DDoS אפשרי)", stuffing: "חשד ל-Credential Stuffing", blocked: "נחסם אוטומטית", safety: "שסתום ביטחון"
};
const SEV = {
  low: { label: "נמוכה", cls: "bg-sky-500/15 text-sky-300", bar: "#38bdf8" },
  medium: { label: "בינונית", cls: "bg-yellow-500/15 text-yellow-300", bar: "#facc15" },
  high: { label: "גבוהה", cls: "bg-orange-500/20 text-orange-300", bar: "#fb923c" },
  critical: { label: "קריטית", cls: "bg-red-500/20 text-red-300", bar: "#f87171" }
} as const;
const THREAT = {
  calm: { label: "שקט", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", icon: ShieldCheck },
  elevated: { label: "פעילות חשודה", cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300", icon: Eye },
  high: { label: "התקפה פעילה", cls: "border-orange-500/50 bg-orange-500/10 text-orange-300", icon: ShieldAlert },
  critical: { label: "התקפה חמורה", cls: "border-red-500/60 bg-red-500/15 text-red-300", icon: ShieldAlert }
} as const;

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `לפני ${s} שנ'`;
  if (s < 3600) return `לפני ${Math.round(s / 60)} דק'`;
  if (s < 86400) return `לפני ${Math.round(s / 3600)} ש'`;
  return `לפני ${Math.round(s / 86400)} ימים`;
};
const num = (n: number) => n.toLocaleString("he-IL");

function useVisible() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const on = () => setV(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: "bad" | "warn" | "ok" }) {
  const color = tone === "bad" ? "text-red-300" : tone === "warn" ? "text-yellow-300" : "text-white";
  return (
    <div className="card flex flex-col gap-1.5 p-4">
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Icon className="h-3.5 w-3.5" /> {label}</span>
      <span className={`text-2xl font-black ${color}`}>{value}</span>
      {sub && <span className="text-[11px] text-gray-500">{sub}</span>}
    </div>
  );
}

export default function SecurityCenterPanel() {
  const visible = useVisible();
  const [sum, setSum] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<SecEvent[]>([]);
  const lastId = useRef(0);
  const [attackers, setAttackers] = useState<Attacker[]>([]);
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  const [open, setOpen] = useState<Attacker | null>(null);
  const [openEvents, setOpenEvents] = useState<SecEvent[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [wl, setWl] = useState<string | null>(null);
  const [manualIp, setManualIp] = useState("");
  const [sevFilter, setSevFilter] = useState<"all" | "high">("all");

  const loadSummary = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/security/summary", { cache: "no-store" });
      const j = await r.json();
      if (j.error) { setError(j.error); return; }
      setError("");
      setSum(j);
    } catch { setError("שגיאת רשת בטעינת מרכז האבטחה"); }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const url = lastId.current ? `/api/admin/security/events?after=${lastId.current}&limit=100` : "/api/admin/security/events?limit=60";
      const j = await (await fetch(url, { cache: "no-store" })).json();
      const fresh: SecEvent[] = j.events ?? [];
      if (fresh.length) {
        lastId.current = Math.max(lastId.current, ...fresh.map((e) => e.id));
        setEvents((prev) => [...fresh, ...prev].slice(0, 150));
      }
    } catch {}
  }, []);

  const loadAttackers = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/admin/security/attackers?limit=40", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/security/blocklist", { cache: "no-store" }).then((r) => r.json())
      ]);
      setAttackers(a.attackers ?? []);
      setBlocks(b.entries ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadSummary(); loadEvents(); loadAttackers();
    const t1 = setInterval(loadSummary, 5000);
    const t2 = setInterval(loadEvents, 3000);
    const t3 = setInterval(loadAttackers, 8000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [visible, loadSummary, loadEvents, loadAttackers]);

  async function post(url: string, method: string, body: any, okMsg: string) {
    setBusy(url + JSON.stringify(body)); setMsg("");
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setMsg(j.error ?? "שגיאה");
      else { setMsg(okMsg); loadSummary(); loadAttackers(); }
    } catch { setMsg("שגיאת רשת"); }
    setBusy("");
  }
  const blockIp = (ip: string, minutes: number) => post("/api/admin/security/blocklist", "POST", { action: "block", ip, minutes }, `${ip} נחסם (יוחל תוך שניות)`);
  const releaseIp = (ip: string) => post("/api/admin/security/blocklist", "POST", { action: "release", ip }, `${ip} שוחרר`);
  const allowIp = (ip: string) => post("/api/admin/security/blocklist", "POST", { action: "allow", ip }, `${ip} נוסף לרשימה הלבנה`);

  async function openProfile(a: Attacker) {
    setOpen(a); setOpenEvents([]);
    try {
      const j = await (await fetch(`/api/admin/security/events?ip=${encodeURIComponent(a.ip)}&limit=80`, { cache: "no-store" })).json();
      setOpenEvents(j.events ?? []);
    } catch {}
  }

  const series = sum?.series ?? [];
  const maxReq = Math.max(1, ...series.map((m) => m.req));
  const types = useMemo(() => Object.entries(sum?.byType ?? {}).sort((a, b) => b[1] - a[1]), [sum]);
  const maxType = Math.max(1, ...types.map(([, n]) => n));
  const shownEvents = sevFilter === "high" ? events.filter((e) => e.severity === "high" || e.severity === "critical") : events;
  const tableAttackers = attackers.length ? attackers : sum?.topAttackers ?? [];

  if (error && !sum) return <div className="card p-6 text-center text-red-400">{error}</div>;
  if (!sum) return <div className="card flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  if (!sum.setup) {
    return (
      <div className="card flex flex-col gap-2 p-6 text-sm text-gray-300">
        <div className="text-base font-bold text-white">מרכז האבטחה עדיין לא הופעל בשרת</div>
        <div>צריך להריץ את מיגרציה 0083 (טבלאות האבטחה) ולהפעיל את שירות <code>ogen-sentinel</code> בשרת. ראו deploy/sentinel/README.md.</div>
      </div>
    );
  }

  const T = THREAT[sum.threat];
  const enforce = sum.settings.mode === "enforce";
  const k = sum.kpis;

  return (
    <div className="flex flex-col gap-4">
      {/* כותרת: רמת איום + מצב הגנה */}
      <div className={`card flex flex-wrap items-center justify-between gap-3 border p-4 ${T.cls}`}>
        <div className="flex items-center gap-3">
          <T.icon className="h-7 w-7" />
          <div>
            <div className="text-lg font-black">{T.label}</div>
            <div className="text-xs opacity-80">10 הדקות האחרונות: {sum.last10min.critical} קריטיים · {sum.last10min.high} חמורים · {sum.last10min.blocks} חסימות</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> חי · מתעדכן כל כמה שניות</span>
          <button
            onClick={() => {
              const to = enforce ? "observe" : "enforce";
              if (!confirm(to === "enforce" ? "להפעיל חסימה אוטומטית של תוקפים? (נחסמים רק תוקפים ברורים, וחסימה זמנית)" : "לעבור למצב תיעוד בלבד (בלי חסימה אוטומטית)?")) return;
              post("/api/admin/security/settings", "PATCH", { mode: to }, to === "enforce" ? "חסימה אוטומטית הופעלה" : "עברנו למצב תיעוד בלבד");
            }}
            className={`rounded-lg px-3 py-1.5 font-bold ${enforce ? "bg-emerald-600 text-white" : "bg-surface2 text-gray-300"}`}
          >
            {enforce ? "חסימה אוטומטית: פעילה" : "חסימה אוטומטית: כבויה (תיעוד בלבד)"}
          </button>
        </div>
      </div>
      {msg && <div className="card flex items-center justify-between p-3 text-sm text-gray-200"><span>{msg}</span><button onClick={() => setMsg("")}><X className="h-4 w-4" /></button></div>}

      {/* מדדים */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Kpi icon={Activity} label="בקשות בשנייה (עכשיו)" value={String(k.rpsNow)} sub={`${num(k.req5m)} ב-5 דקות`} />
        <Kpi icon={Gauge} label="זמן תגובה p95" value={`${k.p95ms} מ״ש`} sub="אם עולה - משהו מאט את האתר" tone={k.p95ms > 800 ? "warn" : "ok"} />
        <Kpi icon={Zap} label="נחסמו ע״י nginx (5 דק')" value={num(k.waf5m + k.r4295m)} sub={`${num(k.waf5m)} חשודות · ${num(k.r4295m)} הגבלת קצב`} tone={k.waf5m + k.r4295m > 50 ? "warn" : undefined} />
        <Kpi icon={Ban} label="כתובות חסומות כרגע" value={num(k.activeBlocks)} sub={`${num(k.blockedHits5m)} ניסיונות נחסמו בקרנל`} tone={k.activeBlocks ? "warn" : undefined} />
        <Kpi icon={Radar} label="תוקפים ב-24 שעות" value={num(k.attackers24h)} sub={`${num(k.events24h)} אירועים · ${num(k.high24h)} חמורים`} />
        <Kpi icon={Fingerprint} label="כשלי התחברות (5 דק')" value={num(k.authFail5m)} sub={`שגיאות שרת 5xx: ${num(k.s5xx5m)}`} tone={k.authFail5m > 20 ? "bad" : k.s5xx5m > 10 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* גרף תנועה */}
        <div className="card flex flex-col gap-3 p-5 lg:col-span-2">
          <div className="flex items-center justify-between text-sm font-bold text-white">
            <span>תנועה לפי דקה (שעה אחרונה)</span>
            <span className="flex items-center gap-3 text-[11px] font-normal text-gray-400">
              <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-primary" /> בקשות</span>
              <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-red-400" /> נחסמו / הוגבלו</span>
            </span>
          </div>
          <div className="flex h-40 items-end gap-[2px]" dir="ltr">
            {series.length === 0 && <div className="m-auto text-xs text-gray-500">אין עדיין נתונים - המדדים נאספים דקה אחרי דקה</div>}
            {series.map((m) => {
              const bad = m.waf + m.r429 + m.blocked;
              return (
                <div key={m.minute} className="group relative flex h-full min-w-[3px] flex-1 flex-col justify-end">
                  <div className="w-full bg-red-400" style={{ height: `${Math.min(100, (bad / maxReq) * 100)}%` }} />
                  <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(2, ((m.req - Math.min(m.req, bad)) / maxReq) * 100)}%` }} />
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[10px] text-white group-hover:block">
                    {fmtTime(m.minute).slice(0, 5)} · {m.req} בקשות · {m.waf} חשודות · {m.r429} הגבלות · {m.ips} כתובות · p95 {Math.round(m.p95)}מ״ש
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[11px] text-gray-500">כל עמודה = דקה. החלק האדום = בקשות שנחסמו (סריקות/הזרקות, הגבלת קצב, חסימות בקרנל).</div>
        </div>

        {/* פילוח לפי סוג */}
        <div className="card flex flex-col gap-3 p-5">
          <div className="text-sm font-bold text-white">סוגי התקפות (24 שעות)</div>
          {types.length === 0 && <div className="text-xs text-gray-500">לא זוהו התקפות ב-24 השעות האחרונות</div>}
          <div className="flex flex-col gap-2">
            {types.slice(0, 10).map(([t, n]) => (
              <div key={t} className="flex flex-col gap-1">
                <div className="flex justify-between text-[12px] text-gray-300"><span>{TYPE_LABEL[t] ?? t}</span><span className="font-bold text-white">{num(n)}</span></div>
                <div className="h-1.5 w-full rounded bg-surface2"><div className="h-1.5 rounded bg-primary" style={{ width: `${(n / maxType) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* זרם אירועים חי */}
        <div className="card flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">אירועים חיים</span>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setSevFilter("all")} className={`rounded-lg px-2.5 py-1 ${sevFilter === "all" ? "bg-primary text-white" : "bg-surface2 text-gray-400"}`}>הכול</button>
              <button onClick={() => setSevFilter("high")} className={`rounded-lg px-2.5 py-1 ${sevFilter === "high" ? "bg-primary text-white" : "bg-surface2 text-gray-400"}`}>חמורים בלבד</button>
            </div>
          </div>
          <div className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto">
            {shownEvents.length === 0 && <div className="py-6 text-center text-xs text-gray-500">אין אירועים. כשיזוהה משהו חשוד הוא יופיע כאן מיד.</div>}
            {shownEvents.map((e) => (
              <button key={e.id} onClick={() => { const a = tableAttackers.find((x) => x.ip === e.ip); if (a) openProfile(a); }} className="flex items-start gap-2 rounded-lg bg-surface2/60 p-2 text-start hover:bg-surface2">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${SEV[e.severity].cls}`}>{SEV[e.severity].label}</span>
                <span className="flex min-w-0 flex-1 flex-col text-[12px]">
                  <span className="font-bold text-white">{TYPE_LABEL[e.type] ?? e.type}{e.blocked ? " · נחסם" : ""}</span>
                  <span className="truncate text-gray-400" dir="ltr">{e.ip}{e.path ? `  ${e.method ?? ""} ${e.path}` : ""}</span>
                </span>
                <span className="shrink-0 text-[10px] text-gray-500">{fmtTime(e.ts)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* תוקפים מובילים */}
        <div className="card flex flex-col gap-3 p-5">
          <span className="text-sm font-bold text-white">תוקפים מובילים (פרופיל)</span>
          <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
            {tableAttackers.length === 0 && <div className="py-6 text-center text-xs text-gray-500">לא זוהו תוקפים. מצוין.</div>}
            {tableAttackers.map((a) => (
              <div key={a.ip} className="flex flex-col gap-1.5 rounded-xl bg-surface2/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button onClick={() => openProfile(a)} className="font-mono text-sm font-bold text-white hover:underline" dir="ltr">{a.ip}</button>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {a.blockedUntil ? <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-bold text-red-300">חסום עד {fmtTime(a.blockedUntil).slice(0, 5)}</span> : null}
                    <span className="rounded bg-surface px-1.5 py-0.5 text-gray-300">ציון {a.score}</span>
                    {a.profile?.tool ? <span className="rounded bg-surface px-1.5 py-0.5 text-gray-300">{a.profile.tool}</span> : null}
                  </div>
                </div>
                <div className="text-[12px] text-gray-300">{a.profile?.label || (a.types ?? []).map((t) => TYPE_LABEL[t] ?? t).join(" · ")}</div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                  <span>{num(a.hits)} בקשות · נראה לראשונה {fmtDateTime(a.firstSeen)} · אחרון {ago(a.lastSeen)}</span>
                  <span className="flex gap-1">
                    {a.blockedUntil
                      ? <button disabled={!!busy} onClick={() => releaseIp(a.ip)} className="rounded bg-emerald-600/80 px-2 py-0.5 font-bold text-white">שחרר</button>
                      : <button disabled={!!busy} onClick={() => blockIp(a.ip, 1440)} className="rounded bg-red-600/80 px-2 py-0.5 font-bold text-white">חסום 24 ש'</button>}
                    <button disabled={!!busy} onClick={() => { if (confirm(`לאשר את ${a.ip} לצמיתות? המערכת לא תחסום אותו לעולם.`)) allowIp(a.ip); }} className="rounded bg-surface px-2 py-0.5 text-gray-300">אשר תמיד</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* הגדרות + רשימת חסימות */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card flex flex-col gap-3 p-5">
          <span className="text-sm font-bold text-white">הגדרות הגנה</span>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            סף חסימה אוטומטית (ציון סיכון; ברירת מחדל 100 - תוקף ברור חוצה אותו תוך כמה בקשות)
            <div className="flex gap-2">
              <input type="number" min={40} max={1000} value={score ?? sum.settings.block_score} onChange={(e) => setScore(Number(e.target.value))} className="w-28 rounded-lg bg-surface2 px-3 py-2 text-white" />
              <button onClick={() => post("/api/admin/security/settings", "PATCH", { blockScore: score ?? sum.settings.block_score }, "הסף נשמר")} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">שמור</button>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            רשימה לבנה (כתובת או טווח בכל שורה - לעולם לא ייחסמו, למשל כתובות הבית/המשרד שלכם)
            <textarea rows={3} dir="ltr" value={wl ?? sum.settings.whitelist.join("\n")} onChange={(e) => setWl(e.target.value)} className="rounded-lg bg-surface2 px-3 py-2 font-mono text-xs text-white" placeholder="203.0.113.7&#10;198.51.100.0/24" />
          </label>
          <button
            onClick={() => post("/api/admin/security/settings", "PATCH", { whitelist: (wl ?? sum.settings.whitelist.join("\n")).split("\n").map((s) => s.trim()).filter(Boolean) }, "הרשימה הלבנה נשמרה")}
            className="self-start rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"
          >שמור רשימה לבנה</button>
          <div className="flex gap-2 border-t border-white/5 pt-3">
            <input value={manualIp} onChange={(e) => setManualIp(e.target.value)} dir="ltr" placeholder="חסימה ידנית: כתובת IP" className="flex-1 rounded-lg bg-surface2 px-3 py-2 font-mono text-xs text-white" />
            <button onClick={() => { blockIp(manualIp.trim(), 1440); setManualIp(""); }} className="rounded-lg bg-red-600/80 px-3 py-2 text-xs font-bold text-white">חסום 24 ש'</button>
          </div>
          <div className="text-[11px] leading-relaxed text-gray-500">
            המערכת רצה בנפרד מהאתר ולא מאטה אותו. חסימה היא ברמת הקרנל (nftables) לפורטים 80/443 בלבד, זמנית ומדורגת (15 דק' → שעה → יממה → שבוע).
            כתובות פנימיות ו-Cloudflare לעולם לא נחסמות. מתג חירום בשרת: <code dir="ltr">touch /etc/ogen-sentinel/DISABLE_BLOCK</code>.
          </div>
        </div>

        <div className="card flex flex-col gap-3 p-5">
          <span className="text-sm font-bold text-white">חסימות פעילות ורשימה לבנה</span>
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {blocks.length === 0 && <div className="py-6 text-center text-xs text-gray-500">אין חסימות פעילות</div>}
            {blocks.map((b) => (
              <div key={b.ip} className="flex items-center justify-between gap-2 rounded-lg bg-surface2/60 p-2 text-[12px]">
                <div className="flex min-w-0 flex-col">
                  <span className="font-mono font-bold text-white" dir="ltr">{b.ip}</span>
                  <span className="truncate text-gray-500">{b.status === "allowed" ? "רשימה לבנה" : `חסום עד ${b.until ? fmtDateTime(b.until) : "?"}`} · {b.source === "auto" ? "אוטומטי" : "ידני"}{b.reason ? ` · ${b.reason}` : ""}</span>
                </div>
                <button disabled={!!busy} onClick={() => releaseIp(b.ip)} className="shrink-0 rounded bg-emerald-600/80 px-2 py-1 font-bold text-white">{b.status === "allowed" ? "הסר" : "שחרר"}</button>
              </div>
            ))}
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-500"><Clock className="h-3.5 w-3.5" /> שינויים מוחלים בשרת תוך כ-5 שניות</div>
        </div>
      </div>

      {/* חלון פרופיל תוקף */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(null)}>
          <div className="card flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xl font-black text-white" dir="ltr">{open.ip}</div>
                <div className="mt-1 text-sm text-gray-300">{open.profile?.label || "—"}</div>
              </div>
              <button onClick={() => setOpen(null)} className="rounded-lg bg-surface2 p-2"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-surface2 p-3"><div className="text-gray-500">ציון סיכון</div><div className="text-lg font-black text-white">{open.score}</div></div>
              <div className="rounded-lg bg-surface2 p-3"><div className="text-gray-500">בקשות</div><div className="text-lg font-black text-white">{num(open.hits)}</div></div>
              <div className="rounded-lg bg-surface2 p-3"><div className="text-gray-500">נראה לראשונה</div><div className="font-bold text-white">{fmtDateTime(open.firstSeen)}</div></div>
              <div className="rounded-lg bg-surface2 p-3"><div className="text-gray-500">חסימות עד כה</div><div className="text-lg font-black text-white">{open.blockCount}</div></div>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="text-xs font-bold text-gray-400">שיטות ההתקפה שזוהו</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(open.typeCounts ?? {}).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                  <span key={t} className="rounded-lg bg-surface2 px-2.5 py-1 text-xs text-gray-200">{TYPE_LABEL[t] ?? t} <b className="text-white">×{n}</b></span>
                ))}
              </div>
              {open.profile?.tool && <div className="text-xs text-gray-300"><Globe className="me-1 inline h-3.5 w-3.5" /> כלי משוער: <b className="text-white">{open.profile.tool}</b></div>}
              {(open.profile?.user_agents ?? []).length > 0 && <div className="text-xs text-gray-400" dir="ltr">UA: {(open.profile.user_agents ?? [])[0]}</div>}
              {(open.profile?.top_paths ?? []).length > 0 && (
                <div className="text-xs text-gray-400"><span className="font-bold text-gray-300">נתיבים מובילים: </span><span dir="ltr">{(open.profile.top_paths ?? []).join("  ·  ")}</span></div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-bold text-gray-400">ציר זמן (אירועים אחרונים)</div>
              <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                {openEvents.length === 0 && <div className="py-3 text-center text-xs text-gray-500"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
                {openEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 rounded bg-surface2/60 p-1.5 text-[11px]">
                    <span className="shrink-0 text-gray-500">{fmtTime(e.ts)}</span>
                    <span className={`shrink-0 rounded px-1 font-bold ${SEV[e.severity].cls}`}>{TYPE_LABEL[e.type] ?? e.type}</span>
                    <span className="min-w-0 truncate text-gray-400" dir="ltr">{e.method ?? ""} {e.path ?? ""} {e.status ? `→ ${e.status}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {open.blockedUntil
                ? <button onClick={() => releaseIp(open.ip)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">שחרר חסימה</button>
                : <>
                    <button onClick={() => blockIp(open.ip, 60)} className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-bold text-white">חסום שעה</button>
                    <button onClick={() => blockIp(open.ip, 1440)} className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-bold text-white">חסום יממה</button>
                    <button onClick={() => blockIp(open.ip, 10080)} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">חסום שבוע</button>
                  </>}
              <button onClick={() => { if (confirm(`לאשר את ${open.ip} לצמיתות?`)) allowIp(open.ip); }} className="inline-flex items-center gap-1 rounded-lg bg-surface2 px-4 py-2 text-sm text-gray-200"><Check className="h-4 w-4" /> אשר תמיד</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
