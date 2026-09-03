import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/push";

// ביצוע בפועל של "פעולה מוצעת" שהסוכן הכין והמשתמש אישר בכרטיס.
// שני סוגים: פתיחת פנייה לצוות, והגשת בקשת קהילה (הצעת אפליקציה).
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { messageId, action } = await request.json().catch(() => ({}));
  if (!action || typeof action !== "object") return NextResponse.json({ error: "פעולה חסרה" }, { status: 400 });

  const admin = createAdminSupabase();

  // אימות: הפעולה חייבת להתאים למה שהסוכן הציע בהודעה הזו (מונע זיוף מהלקוח).
  if (messageId) {
    const { data: msg } = await admin
      .from("bot_messages")
      .select("id, meta, conversation_id, bot_conversations(user_id)")
      .eq("id", messageId)
      .single();
    const ownerId = (msg as any)?.bot_conversations?.user_id;
    if (!msg || ownerId !== user.id) return NextResponse.json({ error: "הודעה לא נמצאה" }, { status: 404 });
    const proposed = (msg as any).meta?.proposedAction;
    if (!proposed || proposed.kind !== action.kind) {
      return NextResponse.json({ error: "הפעולה כבר לא זמינה" }, { status: 400 });
    }
    // משתמשים בערכים מהשרת, לא מהלקוח
    action.payload = proposed.payload;
  }

  if (action.kind === "support_ticket") {
    const subject = String(action.payload?.subject || "").trim().slice(0, 120) || "פנייה מהעוזר החכם";
    const body = String(action.payload?.body || "").trim().slice(0, 2000);
    if (!body) return NextResponse.json({ error: "תוכן הפנייה ריק" }, { status: 400 });

    const { data: ticket, error } = await admin
      .from("tickets")
      .insert({ user_id: user.id, subject })
      .select("id")
      .single();
    if (error || !ticket) return NextResponse.json({ error: "שגיאה בפתיחת הפנייה" }, { status: 500 });

    await admin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: "user",
      body: `${body}\n\n—\n(נפתח דרך העוזר החכם)`
    });
    notifyAdmins({ title: "פנייה חדשה מהעוזר החכם", body: subject, url: "/dashboard/admin?tab=tickets" }).catch(() => {});

    return NextResponse.json({ ok: true, done: "הפנייה נפתחה. הצוות יחזור אליך דרך עמוד התמיכה.", link: "/support" });
  }

  if (action.kind === "app_suggestion") {
    const title = String(action.payload?.app_name || "").trim().slice(0, 200);
    if (!title || title.length < 2) return NextResponse.json({ error: "חסר שם אפליקציה" }, { status: 400 });
    const rawLink = String(action.payload?.app_link || "").trim();
    const sourceLink = /^https?:\/\/.+/i.test(rawLink) ? rawLink.slice(0, 400) : null;
    const note = String(action.payload?.note || "").trim().slice(0, 1000) || null;

    const { data, error } = await admin
      .from("community_requests")
      .insert({ requested_by: user.id, title, source_link: sourceLink, note })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: `שגיאה בהגשת הבקשה: ${error?.message ?? ""}` }, { status: 500 });

    return NextResponse.json({ ok: true, done: `הבקשה "${title}" הוגשה ללוח בקשות הקהילה.`, link: "/community" });
  }

  return NextResponse.json({ error: "סוג פעולה לא נתמך" }, { status: 400 });
}
