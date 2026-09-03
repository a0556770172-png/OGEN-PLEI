import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBotConfig, botIsLive } from "@/lib/bot";

// נתיב קליל - הרכיב הצף (BotWidget) קורא לו כדי לדעת אם להציג את הבוט בכלל.
// לא מחזיר שום פרט רגיש (בטח לא את מפתח ה-API).
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ live: false });

  const cfg = await getBotConfig();
  return NextResponse.json({ live: botIsLive(cfg) });
}
