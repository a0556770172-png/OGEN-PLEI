import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { previewOwnership, transferOwnership, findUserByUsername, type AppSource } from "@/lib/appOwnership";

export const dynamic = "force-dynamic";

// טאב "ציבורי ופרטי" בלוח המנהל ובלוח הפיקוח (components/AppOwnershipPanel.tsx).
// הלוגיקה והחישוב של המוניטין - ב-lib/appOwnership.ts.

async function requireStaff() {
  const result = await requireProfile();
  if ("error" in result) return { error: NextResponse.json({ error: result.error }, { status: result.status }) };
  if (!isStaff(result.profile)) return { error: NextResponse.json({ error: "רק צוות יכול לבצע פעולה זו" }, { status: 403 }) };
  return { profile: result.profile };
}

// GET ?q=שם - חיפוש אפליקציות (לא כולל שנדחו), עם הבעלים, הסוג, הורדות ולייקים.
export async function GET(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const admin = createAdminSupabase();
  let query = admin
    .from("apps")
    .select("id, name, source, status, downloads_count, developer_id, developer_name, developer:profiles!apps_developer_id_fkey(username)")
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(40);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data: apps } = await query;

  const ids = (apps ?? []).map((a) => a.id);
  const { data: likes } = ids.length
    ? await admin.from("app_likes").select("app_id").in("app_id", ids).limit(10000)
    : { data: [] as { app_id: string }[] };
  const likeMap = new Map<string, number>();
  for (const l of likes ?? []) likeMap.set(l.app_id, (likeMap.get(l.app_id) ?? 0) + 1);

  return NextResponse.json({
    apps: (apps ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      source: a.source === "public_suggestion" ? "public_suggestion" : "developer_upload",
      status: a.status,
      downloads: a.downloads_count ?? 0,
      likes: likeMap.get(a.id) ?? 0,
      owner: a.developer?.username ?? "—",
      developerName: a.developer_name ?? null
    }))
  });
}

// POST { appId, toSource: "public_suggestion" | "developer_upload", toUsername?, confirm? }
// בלי confirm - תצוגה מקדימה בלבד (מה יקרה למוניטין). עם confirm: true - ביצוע.
export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const appId = typeof body.appId === "string" ? body.appId : "";
  const toSource: AppSource | null =
    body.toSource === "public_suggestion" || body.toSource === "developer_upload" ? body.toSource : null;
  if (!appId || !toSource) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  let toUserId: string | null = null;
  const toUsername = typeof body.toUsername === "string" ? body.toUsername.trim() : "";
  if (toUsername) {
    const user = await findUserByUsername(toUsername);
    if (!user) return NextResponse.json({ error: `לא נמצא משתמש בשם "${toUsername}"` }, { status: 404 });
    toUserId = user.id;
  }

  if (!body.confirm) {
    const preview = await previewOwnership(appId, toSource, toUserId);
    if ("error" in preview) return NextResponse.json({ error: preview.error }, { status: 400 });
    return NextResponse.json({ preview });
  }

  const done = await transferOwnership(appId, toSource, toUserId);
  if ("error" in done) return NextResponse.json({ error: done.error }, { status: 400 });

  await logAudit({
    actorId: auth.profile.id,
    action: "transfer_app",
    targetType: "app",
    targetId: appId,
    targetLabel: done.appName,
    meta: {
      fromSource: done.fromSource,
      toSource: done.toSource,
      from: done.from.username,
      to: done.to.username,
      points: done.ownerChanges ? done.loggedPoints + done.likePointsIn : 0
    },
    undoable: false
  });

  // התראה לבעלים הקודם ולחדש, כדי שידעו למה המוניטין שלהם השתנה.
  if (done.ownerChanges) {
    const admin = createAdminSupabase();
    const moved = done.loggedPoints + done.likePointsOut;
    await admin.from("user_notifications").insert([
      {
        user_id: done.from.id,
        kind: "app_transfer",
        title: `"${done.appName}" הועברה ל-${done.to.username}`,
        body: moved ? `המוניטין שהאפליקציה צברה (${moved}) עבר יחד איתה.` : "הצוות העביר את הבעלות על האפליקציה.",
        url: `/apps/${appId}`
      },
      {
        user_id: done.to.id,
        kind: "app_transfer",
        title: `"${done.appName}" הועברה אליך`,
        body:
          (done.toSource === "developer_upload" ? "היא עכשיו אפליקציה פרטית שלך - אפשר לערוך אותה מהדשבורד." : "היא אפליקציה ציבורית בקרדיט שלך.") +
          (done.loggedPoints + done.likePointsIn ? ` קיבלת ${done.loggedPoints + done.likePointsIn} מוניטין.` : ""),
        url: `/apps/${appId}`
      }
    ]);
  }

  revalidatePath("/");
  revalidatePath(`/apps/${appId}`);
  return NextResponse.json({ ok: true, result: done });
}
