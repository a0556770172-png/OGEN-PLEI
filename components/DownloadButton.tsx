"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AppStatus } from "@/types/database";

export default function DownloadButton({
  appId,
  status,
  downloadsCount,
  isPaused
}: {
  appId: string;
  status: AppStatus;
  downloadsCount: number;
  isPaused?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(downloadsCount);

  async function handleDownload() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/apps/${appId}`);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/download/${appId}`, { method: "POST" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "אירעה שגיאה בהורדה");
      return;
    }
    setCount((c) => c + 1);
    window.location.href = json.url;
  }

  if (status !== "approved") {
    return <button disabled className="btn-ghost opacity-60">האפליקציה אינה זמינה להורדה כעת</button>;
  }

  if (isPaused) {
    return <button disabled className="btn-ghost opacity-60">המפתח השהה זמנית את ההורדה של האפליקציה הזו</button>;
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <button onClick={handleDownload} disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {loading ? "מכין הורדה..." : `הורדה (${count.toLocaleString("he-IL")})`}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="flex items-center gap-1 text-xs text-gray-500"><Lock className="h-3 w-3" /> נדרשת התחברות להורדה</p>
    </div>
  );
}
