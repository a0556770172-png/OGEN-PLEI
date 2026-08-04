import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/push";

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (profile.role !== "developer") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול לבקש שדרוג" }, { status: 403 });
  }
  if (profile.is_pro) {
    return NextResponse.json({ error: "כבר יש לך חשבון PRO" }, { status: 400 });
  }
  if (profile.pro_status === "requested") {
    return NextResponse.json({ error: "כבר קיימת בקשה ממתינה" }, { status: 400 });
  }

  const { message } = await request.json().catch(() => ({ message: "" }));
  const admin = createAdminSupabase();

  // תשובה אוטומטית שנשמרת מיד על הבקשה עצמה (מוצגת למפתח מתחת לכפתור הבקשה בעמוד הפרופיל,
  // דרך admin_message הקיים) - סירוב עדין ומסביר, לא דחייה סופית. המנהל עדיין יכול לאשר בהמשך,
  // וההודעה הזו רק מנהלת ציפיות עד אז.
  const AUTO_REPLY =
    "תודה על הפנייה! שדרוג ל-PRO אינו ניתן אוטומטית מיד עם הבקשה - הפעלת המערכת (אחסון, תעבורה ותחזוקה) כרוכה בעלות כספית, ומעמד PRO נועד בעיקר לעזור לנו לשפר את המאגר ואת יכולות האתר לטובת כלל המשתמשים. לכן קיימים תנאים וקריטריונים למתן שדרוג, והבקשה שלך תיבדק בהתאם - אפשר לקרוא עוד בעמוד ההסברים איך אפשר להגיע ל-PRO גם בדרך עצמאית (צבירת מוניטין). אם יש לך רעיון, הצעה לשיפור או שאלה - נשמח לשמוע דרך הפורום או בהודעה לצוות הניהול.";

  await admin.from("pro_requests").insert({
    developer_id: user.id,
    message: message || null,
    status: "pending",
    admin_message: AUTO_REPLY
  });
  await admin.from("profiles").update({ pro_status: "requested" }).eq("id", user.id);
  notifyAdmins({ title: "בקשת שדרוג PRO חדשה", body: `${profile.username} ביקש שדרוג לחשבון PRO`, url: "/dashboard/admin" }).catch(() => {});

  return NextResponse.json({ ok: true, autoReply: AUTO_REPLY });
}
