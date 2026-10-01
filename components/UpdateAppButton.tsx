import Link from "next/link";
import { Sparkles } from "lucide-react";

// "עדכן את האפליקציה" - כפתור חמוד שמופיע בכל אפליקציה ציבורית מאושרת. מוביל לטופס העלאת
// גרסה חדשה (app/apps/[id]/update). אחרי אישור הצוות - המעלה הופך לבעלים.
export default function UpdateAppButton({ appId }: { appId: string }) {
  return (
    <Link
      href={`/apps/${appId}/update`}
      title="יש לכם גרסה חדשה יותר? העלו אותה, ואחרי אישור הצוות האפליקציה תעבור אליכם"
      className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-primary to-accent px-4 py-1.5 text-xs font-bold text-[#fff] shadow-glow transition hover:scale-105 hover:brightness-110 active:scale-95"
    >
      <Sparkles className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
      עדכן את האפליקציה
    </Link>
  );
}
