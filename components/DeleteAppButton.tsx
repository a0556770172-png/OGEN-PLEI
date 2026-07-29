"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export default function DeleteAppButton({ appId }: { appId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("למחוק את האפליקציה לצמיתות?")) return;
    setLoading(true);
    const res = await fetch(`/api/apps/${appId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("שגיאה במחיקה");
  }

  return (
    <button onClick={handleDelete} disabled={loading} className="rounded-lg p-2 text-red-400 transition hover:bg-red-500/10">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
