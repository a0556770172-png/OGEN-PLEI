"use client";
import { useState } from "react";
import { KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordCard() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    setErr("");
    if (pw.length < 6) return setErr("הסיסמה צריכה להיות באורך 6 תווים לפחות");
    if (pw !== pw2) return setErr("הסיסמאות אינן תואמות");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr("לא הצלחנו לעדכן את הסיסמה. נסה שוב");
      return;
    }
    setPw("");
    setPw2("");
    setOpen(false);
    setMsg("הסיסמה עודכנה בהצלחה");
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="card flex w-full flex-col gap-3 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white">שינוי סיסמה</p>
          <p className="text-sm text-gray-400">
            קביעת סיסמה חדשה לחשבון - אתה כבר מחובר, אז אין צורך להזין את הסיסמה הישנה.
          </p>
        </div>
        {!open && (
          <button onClick={() => { setOpen(true); setErr(""); }} className="btn-ghost shrink-0 text-sm">
            שינוי
          </button>
        )}
      </div>

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <Check className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-2">
          <input
            dir="rtl"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="סיסמה חדשה (לפחות 6 תווים)"
            className="input-field text-sm"
            autoFocus
          />
          <input
            dir="rtl"
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="אימות סיסמה חדשה"
            className="input-field text-sm"
          />
          {err && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {err}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} שמירת סיסמה
            </button>
            <button
              onClick={() => { setOpen(false); setPw(""); setPw2(""); setErr(""); }}
              className="btn-ghost text-sm text-gray-400"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
