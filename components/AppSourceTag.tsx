import { Globe, Lock } from "lucide-react";

// תגית קטנה על כל אפליקציה: ציבורית (נוספה למאגר מהצעה ציבורית) או פרטית (העלאה של המפתח עצמו).
// size="letter" - עיגול זעיר עם אות אחת (פ / צ) לכרטיסים במסך הבית, כדי לא להעמיס על העיצוב.
export default function AppSourceTag({ source, size = "md" }: { source: "developer_upload" | "public_suggestion"; size?: "letter" | "sm" | "md" }) {
  const isPublic = source === "public_suggestion";

  if (size === "letter") {
    const label = isPublic ? "אפליקציה ציבורית" : "אפליקציה פרטית";
    return (
      <span
        title={label}
        aria-label={label}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black leading-none ring-1 ${
          isPublic ? "bg-accent/10 text-accent ring-accent/30" : "bg-surface2 text-gray-400 ring-border"
        }`}
      >
        {isPublic ? "צ" : "פ"}
      </span>
    );
  }

  const Icon = isPublic ? Globe : Lock;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ring-1 ${
        isPublic ? "bg-accent/10 text-accent ring-accent/25" : "bg-surface2 text-gray-400 ring-border"
      } ${size === "sm" ? "text-[10px]" : "text-[11px]"}`}
    >
      <Icon className="h-3 w-3" /> {isPublic ? "ציבורית" : "פרטית"}
    </span>
  );
}
