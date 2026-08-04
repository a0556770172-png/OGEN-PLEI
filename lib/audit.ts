import { createAdminSupabase } from "./supabase/admin";

export type AuditAction =
  | "ban_user" | "unban_user"
  | "approve_app" | "reject_app" | "delete_app" | "change_app_category"
  | "approve_suggestion" | "reject_suggestion"
  | "approve_pro" | "reject_pro"
  | "approve_deletion_request" | "reject_deletion_request"
  | "approve_app_report" | "reject_app_report"
  | "edit_user_profile"
  | "grant_size_override" | "revoke_size_override"
  | "grant_unlimited_public_upload" | "revoke_unlimited_public_upload"
  | "reply_ban_appeal";

// רושם שורה בלוג הביקורת עבור כל פעולת ניהול/פיקוח משמעותית - כדי שהמנהל יוכל לראות בדיוק
// מי עשה מה, מתי, ולמי, ובמידה וניתן - לבטל את הפעולה. undoable מסמן אם יש כפתור "בטל" זמין.
export async function logAudit(params: {
  actorId: string;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  meta?: Record<string, unknown>;
  undoable?: boolean;
}): Promise<void> {
  try {
    const admin = createAdminSupabase();
    await admin.from("audit_log").insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      target_label: params.targetLabel ?? null,
      meta: params.meta ?? {},
      undoable: params.undoable ?? false
    });
  } catch {
    // רישום הלוג לא אמור אף פעם להפיל את הפעולה המקורית - נכשל בשקט אם יש בעיה זמנית
  }
}
