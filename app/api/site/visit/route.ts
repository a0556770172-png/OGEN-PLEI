import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מונה כניסות כללי לאתר - נקרא פעם אחת לכל טעינת עמוד שורש (layout) חדשה, ראה
// components/SiteVisitTracker.tsx. לא דורש חיבור/התחברות, ולא נכשל בצורה שמפילה את האתר.
// צפיות מצטברות בזיכרון ונשלחות למסד בבת אחת כל כמה שניות - במקום עדכון של אותה שורה בכל
// צפייה בכל עמוד (שהיה צוואר בקבוק תחת עומס). אם השרת נעצר, נאבדות לכל היותר צפיות של כמה שניות.
const FLUSH_MS = 5000;
let pending = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const n = pending;
  pending = 0;
  timer = null;
  if (n <= 0) return;
  try {
    const admin = createAdminSupabase();
    const { error } = await admin.rpc("add_site_visits", { p_n: n });
    if (error) {
      // כשל בספירה לא אמור להפריע לשום דבר אחר באתר - אבל כן רושמים אותו ביומן השרת
      // (journalctl -u ogen-play), כדי שכשל שקט לא ייעלם בלי עקבות כמו שקרה בעבר.
      console.error("add_site_visits failed:", error.message);
      for (let i = 0; i < Math.min(n, 50); i++) await admin.rpc("increment_site_visits");
    }
  } catch (err) {
    console.error("add_site_visits threw:", err);
  }
}

export async function POST() {
  pending++;
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
  return NextResponse.json({ ok: true });
}
