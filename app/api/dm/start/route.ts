import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isDmUnlocked, DM_UNLOCK_THRESHOLD } from "@/lib/dm-eligibility";

// פותח (או מחזיר קיים) שיחת צ'אט בין המשתמש הנוכחי למשתמש אחר. פתיחת שיחה חדשה מותרת
// רק למי שכבר פתח לו הצ'אט (10 אפליקציות/הצעות מאושרות ומעלה) - ראו lib/dm-eligibility.ts.
// מענה על שיחה קיימת אינו דורש את הסף הזה - הוא נבדק רק בפתיחה.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { targetUserId } = await request.json().catch(() => ({}));
  if (!targetUserId || typeof targetUserId !== "string") {
    return NextResponse.json({ error: "חסר משתמש יעד" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "לא ניתן לפתוח שיחה עם עצמך" }, { status: 400 });
  }

  const unlocked = await isDmUnlocked(user.id);
  if (!unlocked) {
    return NextResponse.json(
      { error: `פתיחת שיחה עם משתמש אחר נפתחת אוטומטית לאחר ${DM_UNLOCK_THRESHOLD} אפליקציות/תוכנות שהעלית או שהצעת ואושרו. אפשר לקרוא עוד בעמוד ההסברים.` },
      { status: 403 }
    );
  }

  const admin = createAdminSupabase();
  const { data: target } = await admin.from("profiles").select("id, banned").eq("id", targetUserId).single();
  if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });
  if (target.banned) return NextResponse.json({ error: "לא ניתן לפתוח שיחה עם משתמש חסום" }, { status: 400 });

  // סדר קבוע (a<b) כדי שהאילוץ unique(user_a,user_b) ימנע כפילויות ללא קשר למי פתח ראשון
  const [userA, userB] = [user.id, targetUserId].sort();

  const { data: existing } = await admin
    .from("dm_threads")
    .select("id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, threadId: existing.id });

  const { data: created, error } = await admin
    .from("dm_threads")
    .insert({ user_a: userA, user_b: userB })
    .select("id")
    .single();
  if (error || !created) return NextResponse.json({ error: "שגיאה בפתיחת השיחה" }, { status: 500 });

  return NextResponse.json({ ok: true, threadId: created.id });
}
