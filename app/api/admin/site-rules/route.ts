import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyAllUsers } from "@/lib/push";
import { logAudit } from "@/lib/audit";
import { sanitizeUserHtml } from "@/lib/sanitizeHtml";

// עריכת "חוקי האתר" - צוות (מנהל/פיקוח) בלבד, כמו שאר הרשאות הפיקוח הרגילות.
// שתי פעולות אפשריות:
// - "save": שומר את התוכן החדש בלבד, בלי לגעת בגרסה/להתריע לאף אחד. משמש לתיקוני נוסח שוטפים.
// - "publish": שומר את התוכן, מעלה את מספר הגרסה, ושולח התראת דחיפה לכל המשתמשים - זה מה
//   שגורם לשער (SiteRulesGate.tsx) לקפוץ שוב לכולם, כולל מי שכבר אישר בעבר. לכן זו פעולה
//   שצריך להשתמש בה במודעות - לא בכל שינוי קטן, רק בעדכון שבאמת דורש תשומת לב מכולם.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("site_settings")
    .select("site_rules_html, site_rules_version, site_rules_update_note")
    .eq("id", true)
    .single();

  return NextResponse.json({
    html: data?.site_rules_html ?? null,
    version: data?.site_rules_version ?? 1,
    updateNote: data?.site_rules_update_note ?? null
  });
}

export async function PATCH(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { html, action, updateNote } = await request.json().catch(() => ({}));
  if (typeof html !== "string" || !html.trim()) {
    return NextResponse.json({ error: "לא ניתן לשמור תוכן ריק" }, { status: 400 });
  }
  if (action !== "save" && action !== "publish") {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const cleanHtml = sanitizeUserHtml(html);
  const admin = createAdminSupabase();

  if (action === "save") {
    const { error } = await admin
      .from("site_settings")
      .update({ site_rules_html: cleanHtml, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });

    await logAudit({
      actorId: user.id,
      action: "edit_site_rules",
      targetType: "site_settings",
      targetId: "site_rules",
      undoable: false
    });
    return NextResponse.json({ ok: true });
  }

  // action === "publish" - שינוי משמעותי: שומר, מעלה גרסה, ומתריע לכולם.
  const { data: current } = await admin.from("site_settings").select("site_rules_version").eq("id", true).single();
  const nextVersion = (current?.site_rules_version ?? 1) + 1;

  const { error } = await admin
    .from("site_settings")
    .update({
      site_rules_html: cleanHtml,
      site_rules_version: nextVersion,
      site_rules_update_note: typeof updateNote === "string" && updateNote.trim() ? updateNote.trim() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", true);
  if (error) return NextResponse.json({ error: "שגיאה בפרסום העדכון" }, { status: 500 });

  await logAudit({
    actorId: user.id,
    action: "publish_site_rules_update",
    targetType: "site_settings",
    targetId: "site_rules",
    meta: { version: nextVersion, updateNote: updateNote ?? null },
    undoable: false
  });

  notifyAllUsers({
    title: "חוקי האתר עודכנו",
    body: (typeof updateNote === "string" && updateNote.trim()) || "עדכנו את חוקי עוגן פליי - יש לקרוא ולאשר מחדש בכניסה הבאה לאתר.",
    url: "/site-rules"
  }).catch(() => {});

  return NextResponse.json({ ok: true, version: nextVersion });
}
