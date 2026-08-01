"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, MessageSquare } from "lucide-react";

export default function ProRequestButton({ proStatus, adminMessage }: { proStatus: string; adminMessage?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function request() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/pro-request", { method: "POST", body: JSON.stringify({}) });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error); return; }
    router.refresh();
  }

  const messageBox = adminMessage ? (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-400">
      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-light" />
      <span>"{adminMessage}"</span>
    </p>
  ) : null;

  if (proStatus === "approved") {
    return (
      <div>
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1.5 text-xs font-bold text-gold"><Crown className="h-3.5 w-3.5" /> חשבון PRO פעיל</span>
        {messageBox}
      </div>
    );
  }
  if (proStatus === "requested") {
    return (
      <div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary-light">בקשת PRO ממתינה לאישור מנהל</span>
        {messageBox}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button onClick={request} disabled={loading} className="btn-ghost text-xs">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
        בקש שדרוג לחשבון PRO
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {messageBox}
    </div>
  );
}
