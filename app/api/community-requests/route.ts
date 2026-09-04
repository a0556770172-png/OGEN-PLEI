import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { notifyForCommunityRequest } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// פיצ'ר 4: לוח "בקשות קהילתיות". GET ציבורי (כל אחד רואה את הלוח), POST למשתמש מחובר.

// GET - כל הבקשות, פתוחות קודם, עם שמות המבקש והמתנדב.
export async function GET() {
  const admin = createAdminSupabase();
  const { data: requests } = await admin
    .from("community_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = requests ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.requested_by, r.claimed_by].filter(Boolean)))] as string[];
  const { data: users } = ids.length
    ? await admin.from("profiles").select("id, username").in("id", ids)
    : { data: [] as { id: string; username: string }[] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const enriched = rows.map((r) => ({
    ...r,
    requester: userMap.get(r.requested_by) ?? null,
    claimer: r.claimed_by ? userMap.get(r.claimed_by) ?? null : null
  }));

  // סדר תצוגה: פתוחות -> נתפסו -> בוצעו -> נסגרו, ובתוך כל קבוצה מהחדש לישן.
  const order: Record<string, number> = { open: 0, claimed: 1, fulfilled: 2, closed: 3 };
  enriched.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return NextResponse.json({ requests: enriched });
}

// POST - יצירת בקשה חדשה ע"י משתמש מחובר.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const sourceLink = typeof body.sourceLink === "string" ? body.sourceLink.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";

  if (!title || title.length < 2) {
    return NextResponse.json({ error: "יש להזין שם אפליקציה/תוכנה לבקשה" }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "שם הבקשה ארוך מדי" }, { status: 400 });
  }
  // אם הודבק קישור - חייב להיות כתובת http/https תקינה (מניעת קלט זדוני/שגוי).
  if (sourceLink && !/^https?:\/\/.+/i.test(sourceLink)) {
    return NextResponse.json({ error: "קישור המקור חייב להתחיל ב-http:// או https://" }, { status: 400 });
  }

  // שימוש בלקוח המשתמש (server client) כדי שמדיניות ה-RLS (requested_by = auth.uid) תיאכף.
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("community_requests")
    .insert({
      requested_by: user.id,
      title,
      source_link: sourceLink || null,
      note: note || null,
      category: category || null
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: `שגיאה ביצירת הבקשה: ${error.message}` }, { status: 500 });

  try {
    await notifyForCommunityRequest(data.id, title, user.id);
  } catch {
    // התראות לא מכשילות את יצירת הבקשה
  }

  return NextResponse.json({ request: data });
}
