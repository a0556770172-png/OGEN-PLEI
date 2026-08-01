import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// עדכון תגית "הערות" ותגית "מייל להצגה" בפרופיל - שני השדות ניתנים לעריכה תמיד ע"י בעל
// החשבון עצמו (שלא כמו שם המשתמש והמייל שנרשם בו, שאינם ניתנים לשינוי כאן). תגית המייל
// היא שדה נפרד לגמרי מהמייל האמיתי של ההרשמה, וניתן להסתיר אותה או להציג אותה כרצון המשתמש.
export async function PATCH(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { notes, displayEmail, showEmailTag } = await request.json().catch(() => ({}));

  const patch: Record<string, any> = {};

  if (notes !== undefined) {
    const trimmed = typeof notes === "string" ? notes.trim() : "";
    if (trimmed.length > 500) return NextResponse.json({ error: "ההערות ארוכות מדי (עד 500 תווים)" }, { status: 400 });
    patch.notes = trimmed || null;
  }

  if (displayEmail !== undefined) {
    const trimmed = typeof displayEmail === "string" ? displayEmail.trim() : "";
    if (trimmed && !EMAIL_RE.test(trimmed)) {
      return NextResponse.json({ error: "כתובת המייל להצגה אינה תקינה" }, { status: 400 });
    }
    patch.display_email = trimmed || null;
  }

  if (showEmailTag !== undefined) {
    patch.show_email_tag = !!showEmailTag;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: "שגיאה בעדכון הפרופיל" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
