"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

export default function FollowButton({
  targetUserId,
  initialFollowing,
  size = "md"
}: {
  targetUserId: string;
  initialFollowing: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch(`/api/users/${targetUserId}/follow`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFollowing(!next);
      } else {
        setFollowing(!!json.following);
        router.refresh();
      }
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold transition ${pad} ${
        following
          ? "border border-border bg-surface2 text-gray-300 hover:border-red-500/40 hover:text-red-400"
          : "bg-primary text-[#fff] hover:bg-primary-light"
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : following ? (
        <UserCheck className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      {following ? "עוקב/ת" : "עקוב/י"}
    </button>
  );
}
