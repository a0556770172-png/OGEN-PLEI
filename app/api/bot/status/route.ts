import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBotConfig, botIsLive } from "@/lib/bot";
import { maybeRunHealthCheck } from "@/lib/botHealth";

export const dynamic = "force-dynamic";

// נתיב קליל - הרכיב הצף (BotWidget) קורא לו כדי לדעת אם להציג את הבוט בכלל.
// לא מחזיר שום פרט רגיש (בטח לא את מפתח ה-API).
// כשהבוט הוסתר אוטומטית (כל המפתחות נכשלו) - הוא מדווח כלא-קיים, וכל קריאה כאן גם
// מפעילה (לכל היותר פעם בכמה דקות) בדיקת רקע אם הבוט חזר לעבוד - ראו lib/botHealth.ts.
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const cfg = await getBotConfig();
  void maybeRunHealthCheck(cfg).catch(() => {});

  const widgetVisible = cfg.widget_visible && !cfg.auto_hidden;
  if (!user) return NextResponse.json({ live: false, widgetVisible });

  return NextResponse.json({ live: botIsLive(cfg), widgetVisible });
}
