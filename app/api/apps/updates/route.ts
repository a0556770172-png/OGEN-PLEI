import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserAppUpdates } from "@/lib/updates";

export const dynamic = "force-dynamic";

// פיצ'ר 5: מחזיר למשתמש המחובר את רשימת האפליקציות שהוא הוריד ושיש להן עדכון גרסה זמין.
// משמש את חלונית הכניסה (components/UpdatesPopup.tsx) שמיידעת על העדכונים בכניסה לאתר.
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ updates: [] });

  const updates = await getUserAppUpdates(user.id);
  return NextResponse.json({ updates: [...updates.values()] });
}
