import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// המנויים של המשתמש הנוכחי. עבור מנויי מפתח/קטגוריה - מצרפים גם שם לתצוגה.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: subs } = await admin
    .from("notification_subscriptions")
    .select("type, target_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = subs ?? [];
  const devIds = rows.filter((r) => r.type === "developer").map((r) => r.target_id);
  const catValues = rows.filter((r) => r.type === "category").map((r) => r.target_id);

  const [{ data: devs }, { data: cats }] = await Promise.all([
    devIds.length ? admin.from("profiles").select("id, username").in("id", devIds) : Promise.resolve({ data: [] as any[] }),
    catValues.length ? admin.from("categories").select("value, label").in("value", catValues) : Promise.resolve({ data: [] as any[] })
  ]);
  const devMap = new Map((devs ?? []).map((d: any) => [d.id, d.username]));
  const catMap = new Map((cats ?? []).map((c: any) => [c.value, c.label]));

  return NextResponse.json({
    subscriptions: rows.map((r) => ({
      type: r.type,
      targetId: r.target_id,
      label:
        r.type === "developer"
          ? devMap.get(r.target_id) ?? "מפתח"
          : r.type === "category"
          ? catMap.get(r.target_id) ?? r.target_id
          : r.type === "new_public"
          ? "כל אפליקציה ציבורית חדשה"
          : "כל אפליקציה חדשה באתר"
    }))
  });
}
