import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// בודק אם המשתמש המחובר כבר הוריד את האפליקציה/תוכנה הזו בעבר (לפי download_events) -
// כדי להציג אזהרה עדינה לפני הורדה חוזרת בטעות. לא חוסם כלום, רק מידע.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ alreadyDownloaded: false });

  const admin = createAdminSupabase();
  const { count } = await admin
    .from("download_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("app_id", params.id);

  return NextResponse.json({ alreadyDownloaded: (count ?? 0) > 0 });
}
