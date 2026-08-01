"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Loader2 } from "lucide-react";

// כפתור "פתיחת שיחה" בפרופיל ציבורי - מוצג רק אם המבקר עצמו (המשתמש המחובר) כבר פתח לו
// את הצ'אט (10 אפליקציות/הצעות שאושרו ומעלה), ומעביר אותו לשיחה עם בעל הפרופיל הזה.
export default function DmButton({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/dm/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error || "שגיאה בפתיחת השיחה"); return; }
    router.push(`/messages/${json.threadId}`);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={start} disabled={busy} className="btn-ghost text-sm">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
        פתיחת שיחה
      </button>
      {error && <p className="max-w-xs text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
