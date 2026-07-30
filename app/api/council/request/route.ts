import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// בקשה לפתיחת "ועדה" - ערוץ חירום/עדכונים לכל צוות הפיקוח. מנהל בפועל פותח באופן מיידי;
// חבר צוות פיקוח רק "מבקש", ואם עוד חבר צוות שונה מבקש גם הוא תוך 24 שעות - זה נפתח
// אוטומטית בלי לחכות לאישור מנהל, וגם המנהל רואה את זה (הוא רואה ממילא את כל ה"ועדות").
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות יכול לבקש פתיחת ועדה" }, { status: 403 });
  }

  const { title, reason } = await request.json().catch(() => ({}));
  if (!title?.trim()) {
    return NextResponse.json({ error: "חובה לציין נושא לוועדה" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  // מנהל בפועל פותח ישירות, בלי תור בקשות.
  if (profile.role === "admin") {
    const { data: thread, error } = await admin
      .from("council_threads")
      .insert({ title: title.trim(), opened_by: user.id })
      .select()
      .single();
    if (error || !thread) return NextResponse.json({ error: "שגיאה בפתיחת הוועדה" }, { status: 500 });
    if (reason?.trim()) {
      await admin.from("council_messages").insert({ thread_id: thread.id, sender_id: user.id, body: reason.trim() });
    }
    return NextResponse.json({ thread, opened: true });
  }

  // חבר צוות פיקוח - נרשמת בקשה, ובודקים אם כבר יש בקשה ממתינה מחבר צוות אחר ב-24 השעות האחרונות.
  const { data: myRequest, error: reqError } = await admin
    .from("council_open_requests")
    .insert({ requested_by: user.id, title: title.trim(), reason: reason?.trim() || null })
    .select()
    .single();
  if (reqError || !myRequest) return NextResponse.json({ error: "שגיאה בשליחת הבקשה" }, { status: 500 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingRequests } = await admin
    .from("council_open_requests")
    .select("*")
    .eq("status", "pending")
    .gte("created_at", since);

  const distinctRequesters = new Set((pendingRequests ?? []).map((r) => r.requested_by));

  if (distinctRequesters.size >= 2) {
    const combinedReason = (pendingRequests ?? [])
      .map((r) => r.reason?.trim())
      .filter(Boolean)
      .join("\n---\n");

    const { data: thread, error } = await admin
      .from("council_threads")
      .insert({ title: title.trim(), opened_by: user.id, auto_approved: true })
      .select()
      .single();
    if (error || !thread) return NextResponse.json({ error: "שגיאה בפתיחת הוועדה" }, { status: 500 });

    if (combinedReason) {
      await admin.from("council_messages").insert({
        thread_id: thread.id,
        sender_id: user.id,
        body: `הוועדה נפתחה אוטומטית לאחר ${distinctRequesters.size} בקשות עצמאיות מהצוות:\n${combinedReason}`
      });
    }

    const ids = (pendingRequests ?? []).map((r) => r.id);
    await admin.from("council_open_requests").update({ status: "fulfilled" }).in("id", ids);

    return NextResponse.json({ thread, opened: true, autoApproved: true });
  }

  return NextResponse.json({ opened: false, pendingCount: distinctRequesters.size });
}
