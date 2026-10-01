import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { MAX_SUGGESTION_MB } from "@/lib/constants";
import { consumeOversizeGrant } from "@/lib/uploadQuota";
import { sanitizeUserHtml } from "@/lib/sanitizeHtml";
import { platformOverrideFor } from "@/lib/fileKind";
import { createVersionProposal, approveVersionProposal } from "@/lib/versionProposals";

// שלב 2 של "עדכן את האפליקציה": שומר את הגרסה החדשה כהצעה ממתינה לאישור הצוות. האפליקציה
// החיה לא משתנה עד האישור. באישור - המעלה הופך לבעלים (ראו lib/versionProposals.ts).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id, status, source").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });
  if (app.status !== "approved" || app.source !== "public_suggestion") {
    return NextResponse.json({ error: "אפשר לעדכן כך רק אפליקציה ציבורית שמפורסמת בחנות" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { fileKey, fileName, fileSize, version, name, shortDescription, descriptionHtml, category, iconKey, minAndroidVersion, offlineSupport, zipTarget } = body;

  if (!fileKey || !fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }
  // אבטחה: הקבצים חייבים להיות כאלה שהמשתמש עצמו העלה עכשיו (upload-init מייצר אותם בתיקייה שלו)
  if (typeof fileKey !== "string" || !fileKey.startsWith(`apps/${user.id}/`)) {
    return NextResponse.json({ error: "אין הרשאה לקובץ הזה" }, { status: 403 });
  }
  if (iconKey && (typeof iconKey !== "string" || !iconKey.startsWith(`icons/${user.id}/`))) {
    return NextResponse.json({ error: "אין הרשאה לאייקון הזה" }, { status: 403 });
  }
  if (!version || !String(version).trim()) {
    return NextResponse.json({ error: "חובה למלא את מספר הגרסה" }, { status: 400 });
  }
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "חובה למלא את שם האפליקציה" }, { status: 400 });
  }

  let proposal;
  try {
    proposal = await createVersionProposal({
      app_id: app.id,
      uploader_id: user.id,
      kind: "public",
      version: String(version).trim(),
      file_key: fileKey,
      file_name: String(fileName),
      file_size_bytes: Number(fileSize),
      icon_key: iconKey ?? null,
      name: String(name).trim().slice(0, 120),
      short_description: String(shortDescription ?? "").slice(0, 140),
      description_html: sanitizeUserHtml(descriptionHtml ?? ""),
      category: category ? String(category) : null,
      min_android_version: minAndroidVersion ? String(minAndroidVersion).trim() : null,
      offline_support: ["offline", "online", "unknown"].includes(offlineSupport) ? offlineSupport : null,
      platform_override: platformOverrideFor(String(fileName), zipTarget)
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "שגיאה בשמירת הגרסה החדשה" }, { status: 500 });
  }

  await consumeOversizeGrant(profile, Number(fileSize), MAX_SUGGESTION_MB);

  // מנהל בפועל לא צריך לאשר לעצמו - הגרסה מתפרסמת מיד (כמו בהעלאה רגילה של מנהל).
  if (profile.role === "admin") {
    const res = await approveVersionProposal(proposal.id, user.id);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, approved: true });
  }

  return NextResponse.json({ ok: true, approved: false });
}
