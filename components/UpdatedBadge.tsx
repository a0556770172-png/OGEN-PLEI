import { RefreshCw } from "lucide-react";
import { isRecentlyUpdated } from "@/lib/updatedBadge";

// תווית "עודכן" - מוצגת כמה ימים אחרי שאושרה לאפליקציה גרסה חדשה (apps.last_updated_at).
export default function UpdatedBadge({ lastUpdatedAt, size = "md" }: { lastUpdatedAt?: string | null; size?: "sm" | "md" }) {
  if (!isRecentlyUpdated(lastUpdatedAt)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary-light ring-1 ring-primary/30 ${
        size === "sm" ? "text-[10px]" : "text-[11px]"
      }`}
    >
      <RefreshCw className="h-3 w-3" /> עודכן
    </span>
  );
}
