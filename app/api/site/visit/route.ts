import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מונה כניסות כללי לאתר - נקרא פעם אחת לכל טעינת עמוד שורש (layout) חדשה, ראה
// components/SiteVisitTracker.tsx. לא דורש חיבור/התחברות, ולא נכשל בצורה שמפילה את האתר.
export async function POST() {
  try {
    const admin = createAdminSupabase();
    const { error } = await admin.rpc("increment_site_visits");
    // כשל בספירה לא אמור להפריע לשום דבר אחר באתר - אבל כן רושמים אותו ביומן השרת
    // (journalctl -u ogen-play), כדי שכשל שקט לא ייעלם בלי עקבות כמו שקרה בעבר.
    if (error) console.error("increment_site_visits failed:", error.message);
  } catch (err) {
    console.error("increment_site_visits threw:", err);
  }
  return NextResponse.json({ ok: true });
}
