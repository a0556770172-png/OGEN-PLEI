import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "./supabase/admin";
import { deleteObject, BUCKETS } from "./r2";
import { addPoints } from "./points";
import { logAudit } from "./audit";
import { notifyForApprovedApp } from "./notifications";

// גרסאות חדשות שממתינות לאישור צוות (טבלת app_version_proposals, מיגרציה 0066).
// האפליקציה החיה לא משתנה עד האישור - כך שהגרסה הקודמת ממשיכה להופיע בחנות ולהיות זמינה
// להורדה. באישור: הקובץ והפרטים עוברים לאפליקציה, והקובץ הישן נמחק לגמרי מהאחסון.
// בעדכון ציבורי (kind = public) - מי שהעלה הופך לבעלים, וההורדות מעכשיו נזקפות לו.

export type VersionProposalKind = "owner" | "public";

export interface VersionProposal {
  id: string;
  app_id: string;
  uploader_id: string;
  kind: VersionProposalKind;
  status: "pending" | "approved" | "rejected";
  version: string;
  file_key: string;
  file_name: string;
  file_size_bytes: number;
  icon_key: string | null;
  name: string | null;
  short_description: string | null;
  description_html: string | null;
  category: string | null;
  min_android_version: string | null;
  offline_support: string | null;
  platform_override: "apk" | "software" | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// בונוס מוניטין למי שעדכן אפליקציה ציבורית וקיבל את הבעלות עליה - כמו בהעלאה חדשה.
const PUBLIC_UPDATE_POINTS = 5;

// מוחק קבצים מהאחסון בלי להכשיל את הפעולה אם המחיקה נכשלה.
async function removeFiles(fileKey: string | null | undefined, iconKey: string | null | undefined) {
  if (fileKey) await deleteObject(BUCKETS.apps, fileKey).catch(() => {});
  if (iconKey) await deleteObject(BUCKETS.assets, iconKey).catch(() => {});
}

// הצעה חדשה מחליפה הצעה ממתינה קודמת של אותו משתמש לאותה אפליקציה (כדי שלא יצטברו
// כפילויות בתור הבדיקה, ושהקבצים הישנים שלה לא יישארו סתם באחסון).
export async function createVersionProposal(row: Omit<VersionProposal, "id" | "status" | "review_note" | "reviewed_by" | "reviewed_at" | "created_at">) {
  const admin = createAdminSupabase();
  const { data: previous } = await admin
    .from("app_version_proposals")
    .select("id, file_key, icon_key")
    .eq("app_id", row.app_id)
    .eq("uploader_id", row.uploader_id)
    .eq("status", "pending");
  for (const p of previous ?? []) {
    await admin.from("app_version_proposals").delete().eq("id", p.id);
    await removeFiles(p.file_key, p.icon_key);
  }

  const { data, error } = await admin.from("app_version_proposals").insert(row).select().single();
  if (error || !data) throw new Error(error?.message ?? "שגיאה בשמירת הגרסה החדשה");
  return data as VersionProposal;
}

export async function approveVersionProposal(proposalId: string, reviewerId: string): Promise<{ error?: string }> {
  const admin = createAdminSupabase();
  const { data: p } = await admin.from("app_version_proposals").select("*").eq("id", proposalId).single();
  if (!p) return { error: "הגרסה לא נמצאה" };
  if (p.status !== "pending") return { error: "הגרסה כבר טופלה" };
  const proposal = p as VersionProposal;

  const { data: app } = await admin.from("apps").select("*").eq("id", proposal.app_id).single();
  if (!app) return { error: "האפליקציה לא נמצאה" };

  const previousOwnerId = app.developer_id as string;
  const transfersOwnership = proposal.kind === "public" && proposal.uploader_id !== previousOwnerId;
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    file_key: proposal.file_key,
    file_name: proposal.file_name,
    file_size_bytes: proposal.file_size_bytes,
    version: proposal.version,
    // הקובץ התחלף - הסיווג לאפליקציות/תוכנות נקבע מחדש לפי הקובץ החדש (ובחירת המשתמש ל-ZIP)
    platform_override: proposal.platform_override,
    status: "approved",
    review_note: null,
    reviewed_by: reviewerId,
    reviewed_at: now,
    updated_at: now,
    last_updated_at: now
  };
  if (proposal.icon_key) patch.icon_key = proposal.icon_key;
  if (proposal.name) patch.name = proposal.name;
  if (proposal.short_description !== null) patch.short_description = proposal.short_description;
  if (proposal.description_html !== null) patch.description_html = proposal.description_html;
  if (proposal.category) patch.category = proposal.category;
  if (proposal.min_android_version) patch.min_android_version = proposal.min_android_version;
  if (proposal.offline_support) patch.offline_support = proposal.offline_support;
  if (transfersOwnership) patch.developer_id = proposal.uploader_id;

  const { error } = await admin.from("apps").update(patch).eq("id", app.id);
  if (error) return { error: `שגיאה בעדכון האפליקציה: ${error.message}` };

  await admin
    .from("app_version_proposals")
    .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: now })
    .eq("id", proposal.id);

  // רק עכשיו, אחרי שהגרסה החדשה באוויר - מוחקים לגמרי את הקובץ הישן (ואת האייקון הישן אם הוחלף).
  await removeFiles(
    app.file_key && app.file_key !== proposal.file_key ? app.file_key : null,
    proposal.icon_key && app.icon_key && app.icon_key !== proposal.icon_key ? app.icon_key : null
  );

  if (transfersOwnership) {
    await admin.from("points_log").insert({ profile_id: proposal.uploader_id, delta: PUBLIC_UPDATE_POINTS, reason: "app_update", app_id: app.id });
    await addPoints(proposal.uploader_id, PUBLIC_UPDATE_POINTS);
  }

  try {
    // מקפיץ את האפליקציה לראש החנות (published_at) ומתריע למנויים על גרסה חדשה
    await notifyForApprovedApp(app.id);
  } catch {
    // התראות לא אמורות להכשיל את האישור
  }

  const appName = (proposal.name || app.name) as string;
  const { data: uploader } = await admin.from("profiles").select("username").eq("id", proposal.uploader_id).single();
  const notifs: { user_id: string; kind: string; title: string; body: string; url: string }[] = [];
  if (proposal.uploader_id !== reviewerId) {
    notifs.push({
      user_id: proposal.uploader_id,
      kind: "app_version_approved",
      title: `הגרסה החדשה של "${appName}" אושרה`,
      body: transfersOwnership
        ? `גרסה ${proposal.version} פורסמה בחנות, והאפליקציה עכשיו בבעלותך - ההורדות מעכשיו נזקפות לך. קיבלת ${PUBLIC_UPDATE_POINTS} מוניטין.`
        : `גרסה ${proposal.version} פורסמה בחנות.`,
      url: `/apps/${app.id}`
    });
  }
  if (transfersOwnership) {
    notifs.push({
      user_id: previousOwnerId,
      kind: "app_transfer",
      title: `"${appName}" עודכנה ע"י ${uploader?.username ?? "משתמש אחר"}`,
      body: "הוא העלה גרסה חדשה שאושרה, והבעלות עברה אליו. המוניטין שצברת עד עכשיו נשאר אצלך.",
      url: `/apps/${app.id}`
    });
  }
  if (notifs.length) await admin.from("user_notifications").insert(notifs);

  await logAudit({
    actorId: reviewerId,
    action: "approve_app_version",
    targetType: "app",
    targetId: app.id,
    targetLabel: appName,
    meta: { version: proposal.version, previousVersion: app.version, uploader: uploader?.username ?? null, ownerChanged: transfersOwnership },
    undoable: false
  });

  revalidatePath("/");
  revalidatePath(`/apps/${app.id}`);
  revalidatePath("/users");
  revalidatePath(`/users/${previousOwnerId}`);
  revalidatePath(`/users/${proposal.uploader_id}`);
  return {};
}

export async function rejectVersionProposal(proposalId: string, reviewerId: string, note: string | null): Promise<{ error?: string }> {
  const admin = createAdminSupabase();
  const { data: p } = await admin.from("app_version_proposals").select("*").eq("id", proposalId).single();
  if (!p) return { error: "הגרסה לא נמצאה" };
  if (p.status !== "pending") return { error: "הגרסה כבר טופלה" };
  const proposal = p as VersionProposal;
  const { data: app } = await admin.from("apps").select("name").eq("id", proposal.app_id).single();
  const appName = proposal.name || app?.name || "האפליקציה";

  await admin
    .from("app_version_proposals")
    .update({ status: "rejected", review_note: note, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", proposal.id);
  await removeFiles(proposal.file_key, proposal.icon_key);

  await admin.from("user_notifications").insert({
    user_id: proposal.uploader_id,
    kind: "app_version_rejected",
    title: `הגרסה החדשה של "${appName}" נדחתה`,
    body: note ? `סיבה: ${note}` : "הגרסה הקודמת נשארת בחנות כרגיל.",
    url: `/apps/${proposal.app_id}`
  });

  await logAudit({
    actorId: reviewerId,
    action: "reject_app_version",
    targetType: "app",
    targetId: proposal.app_id,
    targetLabel: appName,
    meta: { version: proposal.version, note },
    undoable: false
  });
  return {};
}
