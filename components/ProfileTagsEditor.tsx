"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Mail, Loader2, Save } from "lucide-react";

// עריכת תגית "הערות" ותגית "מייל להצגה" בפרופיל האישי - שני השדות האלה תמיד ניתנים
// לעריכה ע"י בעל החשבון (שלא כמו שם המשתמש והמייל שנרשם בו). תגית המייל היא שדה נפרד
// לגמרי, וניתן להסתיר אותה לחלוטין או להציג אותה כרצון המשתמש.
export default function ProfileTagsEditor({
  initialNotes,
  initialDisplayEmail,
  initialShowEmailTag
}: {
  initialNotes: string | null;
  initialDisplayEmail: string | null;
  initialShowEmailTag: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [displayEmail, setDisplayEmail] = useState(initialDisplayEmail ?? "");
  const [showEmailTag, setShowEmailTag] = useState(initialShowEmailTag);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/profile/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, displayEmail, showEmailTag })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error || "שגיאה בשמירה"); return; }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card flex flex-col gap-5 p-6">
      <h2 className="text-lg font-bold">תגיות פרופיל</h2>
      <p className="-mt-3 text-xs text-gray-500">התגיות האלה מוצגות לכולם בפרופיל הציבורי שלך, ותמיד ניתנות לעריכה על ידך (בשונה משם המשתמש והמייל שנרשמת בו).</p>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><StickyNote className="h-4 w-4" /> תגית הערות</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          className="input-field resize-none"
          placeholder="כתבו כאן הערה שתופיע בפרופיל שלכם (למשל תחומי עניין, שעות מענה וכו')"
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-400"><Mail className="h-4 w-4" /> תגית מייל להצגה</label>
        <p className="mb-1.5 text-xs text-gray-500">זו כתובת נפרדת לגמרי מהמייל שנרשמתם בו - אפשר לבחור אם להציג אותה בפרופיל הציבורי, ואיזו כתובת להציג.</p>
        <input
          type="email"
          value={displayEmail}
          onChange={(e) => setDisplayEmail(e.target.value)}
          className="input-field"
          placeholder="למשל: contact@example.com"
        />
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={showEmailTag} onChange={(e) => setShowEmailTag(e.target.checked)} className="h-4 w-4 rounded border-border" />
          הצג את תגית המייל בפרופיל הציבורי שלי
        </label>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={save} disabled={busy} className="btn-primary w-fit">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saved ? "נשמר!" : "שמירת תגיות"}
      </button>
    </div>
  );
}
