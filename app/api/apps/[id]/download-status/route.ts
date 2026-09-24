import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// בודק אם המשתמש המחובר כבר הוריד את האפליקציה/תוכנה הזו בעבר (לפי download_events) -
// כדי להציג אזהרה עדינה לפני הורדה חוזרת בטעות. לא חוסם כלום, רק מידע.
//
// חשוב: "כבר הורדת" רלוונטי רק אם המשתמש הוריד בעבר בדיוק את הגרסה המפורסמת *הנוכחית* -
// אם המפתח פרסם מאז גרסה חדשה, זו בפועל הורדה של תוכן מעודכן, לא כפילות, ולכן לא מציגים
// את האזהרה (בהתאמה ל-lib/updates.ts שמזהה עדכון בדיוק באותה השוואה).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ alreadyDownloaded: false });

  const admin = createAdminSupabase();
  const [{ data: lastEvent }, { data: app }] = await Promise.all([
    admin
      .from("download_events")
      .select("downloaded_version")
      .eq("user_id", user.id)
      .eq("app_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("apps").select("version").eq("id", params.id).maybeSingle()
  ]);

  const alreadyDownloaded = !!lastEvent && lastEvent.downloaded_version === app?.version;
  return NextResponse.json({ alreadyDownloaded });
}
