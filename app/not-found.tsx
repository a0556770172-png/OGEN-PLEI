import Link from "next/link";

// דף 404 מותאם אישית. חשוב: force-dynamic מונע מ-Next.js לנסות לרנדר את הדף הזה
// כ-HTML סטטי בזמן ה-build (מה שהיה גורם לקריסת ה-build, כי ה-Navbar המשותף
// מפעיל את לקוח ה-Supabase של הדפדפן, שדורש משתני סביבה שלא בהכרח זמינים בשלב הבנייה).
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-glow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="עוגן פליי" className="h-14 w-14" />
      </div>
      <h1 className="text-3xl font-black">הדף לא נמצא</h1>
      <p className="text-gray-400">ייתכן שהקישור שגוי או שהדף הוסר.</p>
      <Link href="/" className="btn-primary mt-2 inline-flex">
        חזרה לדף הבית
      </Link>
    </div>
  );
}
