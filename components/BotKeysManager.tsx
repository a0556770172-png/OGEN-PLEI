"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Loader2, Trash2, Power, PowerOff, RefreshCw, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";

interface KeyRow {
  id: string;
  label: string;
  masked: string;
  enabled: boolean;
  inCooldown: boolean;
  cooldownUntil: string | null;
  lastError: string | null;
  lastOkAt: string | null;
  okCount: number;
  failCount: number;
  sortOrder: number;
}

function cooldownLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `עוד ${mins} דק׳`;
  return `עוד ${Math.ceil(mins / 60)} שע׳`;
}

export default function BotKeysManager() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bot-keys");
      const j = await res.json();
      setKeys(j.keys ?? []);
      setTableMissing(!!j.tableMissing);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!newKey.trim() || busy) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/bot-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: newKey.trim(), label: newLabel.trim() })
    });
    setBusy(false);
    if (res.ok) {
      setNewKey("");
      setNewLabel("");
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "שגיאה בהוספה");
    }
  }

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/bot-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra })
    });
    setBusy(false);
    load();
  }

  async function del(id: string) {
    if (!confirm("למחוק את המפתח הזה מהמאגר?")) return;
    setBusy(true);
    await fetch(`/api/admin/bot-keys/${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  function move(idx: number, dir: -1 | 1) {
    const target = keys[idx + dir];
    if (!target) return;
    const cur = keys[idx];
    act(cur.id, "reorder", { sortOrder: target.sortOrder });
    act(target.id, "reorder", { sortOrder: cur.sortOrder });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
        <KeyRound className="h-4 w-4" /> מפתחות Gemini API (רוטציה אוטומטית)
      </div>
      <p className="text-xs text-gray-500">
        אפשר להוסיף כמה מפתחות מכמה חשבונות Google. הבוט משתמש בהם לפי הסדר, וברגע שמפתח נגמר לו המכסה או נכשל —
        הוא עובר אוטומטית לבא בתור ומחזיר את הנכשל אחרי "קירור". המפתחות נשמרים בשרת בלבד.
      </p>

      {tableMissing && (
        <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
          <AlertCircle className="h-4 w-4 shrink-0" /> יש להריץ את המיגרציה <code dir="ltr">0038_bot_api_keys.sql</code> ב-Supabase כדי להשתמש במאגר מפתחות.
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface2/50 p-3 sm:flex-row">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="שם (אופציונלי, למשל 'חשבון של יוסי')"
          className="input-field sm:w-56"
        />
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="AIza... או AQ..."
          dir="ltr"
          type="password"
          className="input-field flex-1"
        />
        <button onClick={add} disabled={busy || !newKey.trim()} className="btn-primary shrink-0 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} הוסף
        </button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}

      {loading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : keys.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface2/40 p-4 text-center text-xs text-gray-500">
          אין מפתחות במאגר עדיין.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
          {keys.map((k, idx) => (
            <div key={k.id} className="flex items-center gap-2 bg-surface2/40 px-3 py-2.5">
              <div className="flex flex-col">
                <button onClick={() => move(idx, -1)} disabled={idx === 0 || busy} className="text-gray-600 hover:text-white disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === keys.length - 1 || busy} className="text-gray-600 hover:text-white disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{k.label || "מפתח"}</span>
                  <span dir="ltr" className="font-mono text-[11px] text-gray-500">{k.masked}</span>
                  {!k.enabled ? (
                    <span className="rounded-full bg-gray-500/15 px-2 py-0.5 text-[10px] font-bold text-gray-400">כבוי</span>
                  ) : k.inCooldown ? (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">בקירור · {cooldownLabel(k.cooldownUntil)}</span>
                  ) : (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">פעיל</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-600">
                  ✓ {k.okCount} · ✗ {k.failCount}
                  {k.lastError && <span className="text-red-400"> · {k.lastError.slice(0, 80)}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {k.inCooldown && (
                  <button onClick={() => act(k.id, "clear_cooldown")} title="נקה קירור - נסה עכשיו" className="rounded-lg p-1.5 text-gold hover:bg-gold/10">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => act(k.id, k.enabled ? "disable" : "enable")}
                  title={k.enabled ? "כיבוי" : "הפעלה"}
                  className={`rounded-lg p-1.5 hover:bg-surface2 ${k.enabled ? "text-accent" : "text-gray-500"}`}
                >
                  {k.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                </button>
                <button onClick={() => del(k.id)} title="מחיקה" className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">
        מפיקים מפתח חינמי ב-<span dir="ltr">aistudio.google.com/app/apikey</span> (עדיף "Create API key in new project").
      </p>
    </div>
  );
}
