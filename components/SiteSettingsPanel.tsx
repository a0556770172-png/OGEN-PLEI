"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailWarning, Loader2 } from "lucide-react";

export default function SiteSettingsPanel({ requireEmailVerification }: { requireEmailVerification: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(requireEmailVerification);

  async function toggle() {
    const next = !value;
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireEmailVerification: next })
    });
    setBusy(false);
    if (res.ok) {
      setValue(next);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בעדכון ההגדרה");
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-white">
        <MailWarning className="h-5 w-5 text-primary-light" /> אימות מייל בהתחברות
      </div>
      <p className="text-sm text-gray-400">
        כאשר האפשרות פעילה, משתמשים שלא אימתו את כתובת המייל שלהם לא יוכלו להתחבר לאתר - הם יתבקשו לאמת קודם.
        כאשר האפשרות כבויה, כל משתמש יכול להירשם ולהתחבר מיד גם בלי לאמת מייל בכלל. ניתן להדליק/לכבות בכל עת בלחיצת כפתור.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={busy}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${value ? "bg-primary" : "bg-surface2"}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${value ? "right-1" : "right-7"}`}
          />
        </button>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <span className={`text-sm font-bold ${value ? "text-primary-light" : "text-gray-400"}`}>
            {value ? "חובה לאמת מייל כדי להתחבר" : "אין צורך באימות מייל - הרשמה/כניסה חופשית"}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        שימו לב: כדי שהאפשרות הזו תעבוד כראוי, יש לוודא פעם אחת שההגדרה &quot;Confirm email&quot; בלוח הבקרה של Supabase
        (Authentication → Providers → Email) כבויה. אחרת Supabase עצמו יחסום התחברות למשתמשים לא מאומתים, בלי קשר למתג הזה.
      </p>
    </div>
  );
}
