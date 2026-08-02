import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מונה כניסות כללי לאתר - נקרא פעם אחת לכל טעינת עמוד שורש (layout) חדשה, ראה
// components/SiteVisitTracker.tsx. לא דורש חיבור/התחברות, ולא נכשל בצורה שמפילה את האתר.
export async function POST() {
  try {
    const admin = createAdminSupabase();
    await admin.rpc("increment_site_visits");
  } catch {
    // כשל בספירה לא אמור להפריע לשום דבר אחר באתר
  }
  return NextResponse.json({ ok: true });
}
