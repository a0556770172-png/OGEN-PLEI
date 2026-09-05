import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

const MAX_BODY = 5000;
const MAX_TITLE = 140;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 4; // עד 4 פוסטים/תגובות בדקה למשתמש

// יצירת פוסט חדש בפורום (parentId ריק) או תגובה לפוסט קיים.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { title, body, parentId } = await request.json().catch(() => ({}));
  const cleanBody = typeof body === "string" ? body.trim() : "";
  if (cleanBody.length < 2) return NextResponse.json({ error: "צריך לכתוב משהו" }, { status: 400 });
  if (cleanBody.length > MAX_BODY) return NextResponse.json({ error: "הטקסט ארוך מדי" }, { status: 400 });

  const admin = createAdminSupabase();

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("forum_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_MAX) {
    return NextResponse.json({ error: "רגע, יותר מדי הודעות בזמן קצר. נסו שוב עוד דקה." }, { status: 429 });
  }

  let parent: string | null = null;
  let cleanTitle: string | null = null;
  if (typeof parentId === "string" && parentId) {
    const { data: p } = await admin
      .from("forum_posts")
      .select("id, parent_id, hidden")
      .eq("id", parentId)
      .maybeSingle();
    if (!p || p.parent_id || p.hidden) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });
    parent = p.id;
  } else {
    cleanTitle = typeof title === "string" && title.trim() ? title.trim().slice(0, MAX_TITLE) : null;
  }

  const { data: created, error } = await admin
    .from("forum_posts")
    .insert({ user_id: user.id, parent_id: parent, title: cleanTitle, body: cleanBody })
    .select("id")
    .single();
  if (error || !created) return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });

  return NextResponse.json({ ok: true, id: created.id });
}
