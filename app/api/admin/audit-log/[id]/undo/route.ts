import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מבטל פעולת ניהול/פיקוח נתמכת. רק פעולות שסומנו undoable=true בזמן היצירה ניתנות לביטול -
// מחיקות (של אפליקציה/משתמש) לא ניתנות לביטול כי הנתונים כבר נמחקו בפועל.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל יכול לבטל פעולות" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: entry } = await admin.from("audit_log").select("*").eq("id", params.id).single();
  if (!entry) return NextResponse.json({ error: "הרשומה לא נמצאה" }, { status: 404 });
  if (!entry.undoable) return NextResponse.json({ error: "פעולה זו אינה ניתנת לביטול" }, { status: 400 });
  if (entry.undone_at) return NextResponse.json({ error: "הפעולה כבר בוטלה" }, { status: 400 });

  const meta = entry.meta ?? {};

  switch (entry.action) {
    case "ban_user":
      await admin.from("profiles").update({ banned: false }).eq("id", entry.target_id);
      break;
    case "unban_user":
      await admin.from("profiles").update({ banned: true }).eq("id", entry.target_id);
      break;
    case "approve_app":
    case "reject_app":
      await admin.from("apps").update({ status: meta.previousStatus ?? "pending" }).eq("id", entry.target_id);
      revalidatePath("/");
      revalidatePath(`/apps/${entry.target_id}`);
      break;
    case "change_app_category":
      if (meta.from) {
        await admin.from("apps").update({ category: meta.from }).eq("id", entry.target_id);
        revalidatePath("/");
        revalidatePath(`/apps/${entry.target_id}`);
      }
      break;
    case "approve_pro":
    case "reject_pro":
      if (meta.developerId) {
        await admin.from("profiles").update({ is_pro: false, pro_status: "none" }).eq("id", meta.developerId);
      }
      break;
    // ביטול נעיצה/ביטול-נעיצה (פיצ'ר 6) - מחזיר את מצב ה-pinned למה שהיה לפני הפעולה.
    case "pin_app":
      await admin.from("apps").update({ pinned: false, pinned_at: null }).eq("id", entry.target_id);
      revalidatePath("/");
      break;
    case "unpin_app":
      await admin.from("apps").update({ pinned: true, pinned_at: new Date().toISOString() }).eq("id", entry.target_id);
      revalidatePath("/");
      break;
    default:
      return NextResponse.json({ error: "פעולה זו אינה נתמכת לביטול" }, { status: 400 });
  }

  await admin.from("audit_log").update({ undone_at: new Date().toISOString(), undone_by: user.id }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
