import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// פיצ'ר 4: פעולות על בקשה קהילתית - התנדבות/ביטול/סימון בוצע/סגירה/פתיחה מחדש, ומחיקה.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: req } = await admin.from("community_requests").select("*").eq("id", params.id).single();
  if (!req) return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });

  const { action, fulfilledAppId } = await request.json().catch(() => ({}));
  const staff = isStaff(profile);
  const isRequester = req.requested_by === user.id;
  const isClaimer = req.claimed_by === user.id;

  const now = new Date().toISOString();
  const patch: Record<string, any> = { updated_at: now };

  switch (action) {
    // התנדבות למילוי בקשה פתוחה - כל משתמש מחובר.
    case "claim":
      if (req.status !== "open") return NextResponse.json({ error: "הבקשה כבר נתפסה/טופלה" }, { status: 400 });
      patch.status = "claimed";
      patch.claimed_by = user.id;
      patch.claimed_at = now;
      break;

    // ביטול ההתנדבות - המתנדב עצמו או צוות. חוזרת להיות פתוחה.
    case "unclaim":
      if (!isClaimer && !staff) return NextResponse.json({ error: "רק המתנדב או צוות יכולים לבטל התנדבות" }, { status: 403 });
      patch.status = "open";
      patch.claimed_by = null;
      patch.claimed_at = null;
      break;

    // סימון שהקובץ הועלה בפועל - המתנדב, המבקש או צוות.
    case "fulfill":
      if (!isClaimer && !isRequester && !staff) return NextResponse.json({ error: "אין הרשאה לסמן בקשה זו כבוצעה" }, { status: 403 });
      patch.status = "fulfilled";
      patch.fulfilled_by = user.id;
      patch.fulfilled_at = now;
      if (typeof fulfilledAppId === "string" && fulfilledAppId) patch.fulfilled_app_id = fulfilledAppId;
      break;

    // סגירת הבקשה (כבר לא רלוונטית) - המבקש או צוות.
    case "close":
      if (!isRequester && !staff) return NextResponse.json({ error: "רק המבקש או צוות יכולים לסגור בקשה" }, { status: 403 });
      patch.status = "closed";
      break;

    // פתיחה מחדש - המבקש או צוות.
    case "reopen":
      if (!isRequester && !staff) return NextResponse.json({ error: "רק המבקש או צוות יכולים לפתוח מחדש" }, { status: 403 });
      patch.status = "open";
      patch.claimed_by = null;
      patch.claimed_at = null;
      patch.fulfilled_by = null;
      patch.fulfilled_at = null;
      patch.fulfilled_app_id = null;
      break;

    default:
      return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const { error } = await admin.from("community_requests").update(patch).eq("id", req.id);
  if (error) return NextResponse.json({ error: `שגיאה בעדכון הבקשה: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: req } = await admin.from("community_requests").select("requested_by").eq("id", params.id).single();
  if (!req) return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });

  if (req.requested_by !== user.id && !isStaff(profile)) {
    return NextResponse.json({ error: "רק המבקש או צוות יכולים למחוק בקשה" }, { status: 403 });
  }

  await admin.from("community_requests").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
