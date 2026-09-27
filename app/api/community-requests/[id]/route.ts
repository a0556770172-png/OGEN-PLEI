import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";
import { notifyStaffInApp } from "@/lib/notifications";
import { releaseStaleClaims } from "@/lib/communityRequests";

const COMMUNITY_FULFILL_POINTS = 20;

// פיצ'ר 4: פעולות על בקשה קהילתית - התנדבות/ביטול/סימון בוצע/סגירה/פתיחה מחדש, ומחיקה.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  // קודם משחררים התנדבויות שפג תוקפן (שבוע), כדי שגם הבקשה הזו וגם בדיקת "מתנדב כבר לבקשה
  // אחרת" יתבססו על המצב העדכני.
  await releaseStaleClaims().catch(() => {});

  const admin = createAdminSupabase();
  const { data: req } = await admin.from("community_requests").select("*").eq("id", params.id).single();
  if (!req) return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });

  const { action, fulfilledAppId } = await request.json().catch(() => ({}));
  const staff = isStaff(profile);
  const isRequester = req.requested_by === user.id;
  const isClaimer = req.claimed_by === user.id;

  const now = new Date().toISOString();
  const patch: Record<string, any> = { updated_at: now };

  // אישור סופי של "בוצעה" - רק צוות: הבקשה נסגרת כבוצעה ומשולם המוניטין (פעם אחת לבקשה).
  async function approveFulfilled() {
    patch.status = "fulfilled";
    patch.fulfilled_at = now;
    if (!req.fulfilled_by) patch.fulfilled_by = user.id;
    if (typeof fulfilledAppId === "string" && fulfilledAppId) patch.fulfilled_app_id = fulfilledAppId;
    // +20 מוניטין למי שמילא את הבקשה (המתנדב שהתנדב, ואם אין - מי שסימן בוצע).
    // נפרד לגמרי ממוניטין ההעלאה הרגיל, ומשולם פעם אחת לכל בקשה (points_awarded).
    if (!req.points_awarded && req.status !== "fulfilled") {
      const rewardee = req.claimed_by || req.fulfilled_by || user.id;
      patch.points_awarded = true;
      await admin.from("points_log").insert({
        profile_id: rewardee,
        delta: COMMUNITY_FULFILL_POINTS,
        reason: "community_request_fulfilled"
      });
      await addPoints(rewardee, COMMUNITY_FULFILL_POINTS);
    }
  }

  switch (action) {
    // התנדבות למילוי בקשה פתוחה - כל משתמש מחובר, אבל רק לבקשה אחת בכל פעם: מי שכבר מתנדב
    // לבקשה אחרת (בטיפול או ממתינה לאישור) צריך לסיים או לבטל אותה קודם.
    case "claim": {
      if (req.status !== "open") return NextResponse.json({ error: "הבקשה כבר נתפסה/טופלה" }, { status: 400 });
      const { data: active } = await admin
        .from("community_requests")
        .select("id, title")
        .eq("claimed_by", user.id)
        .in("status", ["claimed", "pending_review"])
        .neq("id", req.id)
        .limit(1)
        .maybeSingle();
      if (active) {
        return NextResponse.json(
          { error: `אפשר להתנדב רק לבקשה אחת בכל פעם. סיימו או בטלו קודם את ההתנדבות ל"${active.title}".` },
          { status: 409 }
        );
      }
      patch.status = "claimed";
      patch.claimed_by = user.id;
      patch.claimed_at = now;
      break;
    }

    // ביטול ההתנדבות - המתנדב עצמו או צוות. חוזרת להיות פתוחה.
    case "unclaim":
      if (!isClaimer && !staff) return NextResponse.json({ error: "רק המתנדב או צוות יכולים לבטל התנדבות" }, { status: 403 });
      if (req.status !== "claimed" && req.status !== "pending_review") {
        return NextResponse.json({ error: "אין התנדבות פעילה לבקשה זו" }, { status: 400 });
      }
      patch.status = "open";
      patch.claimed_by = null;
      patch.claimed_at = null;
      patch.fulfilled_by = null;
      patch.fulfilled_app_id = null;
      break;

    // סימון שהקובץ הועלה בפועל. צוות - מאושר מיד. מתנדב/מבקש - עובר ל"ממתינה לאישור צוות",
    // והצוות מקבל התראה. המוניטין משולם רק באישור (approve_fulfill).
    case "fulfill":
      if (!isClaimer && !isRequester && !staff) return NextResponse.json({ error: "אין הרשאה לסמן בקשה זו כבוצעה" }, { status: 403 });
      if (req.status === "fulfilled" || req.status === "closed") {
        return NextResponse.json({ error: "הבקשה כבר סגורה" }, { status: 400 });
      }
      if (staff) {
        patch.fulfilled_by = req.claimed_by || user.id;
        await approveFulfilled();
      } else {
        if (req.status === "pending_review") return NextResponse.json({ error: "הבקשה כבר ממתינה לאישור צוות" }, { status: 400 });
        patch.status = "pending_review";
        patch.fulfilled_by = user.id;
        if (typeof fulfilledAppId === "string" && fulfilledAppId) patch.fulfilled_app_id = fulfilledAppId;
        await notifyStaffInApp(
          {
            kind: "community_review",
            title: `בקשת קהילה ממתינה לאישור: ${req.title}`,
            body: `${profile.username} סימן/ה שהבקשה בוצעה - נא לבדוק ולאשר`,
            url: "/community"
          },
          user.id
        ).catch(() => {});
      }
      break;

    // אישור/דחייה של סימון "בוצעה" - צוות בלבד.
    case "approve_fulfill":
      if (!staff) return NextResponse.json({ error: "רק צוות פיקוח יכול לאשר שבקשה בוצעה" }, { status: 403 });
      if (req.status !== "pending_review") return NextResponse.json({ error: "הבקשה לא ממתינה לאישור" }, { status: 400 });
      await approveFulfilled();
      break;

    case "reject_fulfill":
      if (!staff) return NextResponse.json({ error: "רק צוות פיקוח יכול לדחות סימון בוצעה" }, { status: 403 });
      if (req.status !== "pending_review") return NextResponse.json({ error: "הבקשה לא ממתינה לאישור" }, { status: 400 });
      // חוזרת למתנדב להמשך טיפול (או לפתוחה, אם אין מתנדב).
      patch.status = req.claimed_by ? "claimed" : "open";
      patch.fulfilled_by = null;
      patch.fulfilled_app_id = null;
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
      // הבקשה לא באמת מולאה - מאפסים גם את דגל התשלום כדי שהממלא הבא יזוכה.
      patch.points_awarded = false;
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
