"use client";
import { useEffect, useState } from "react";
import { History, Undo2, Loader2 } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  ban_user: "חסימת משתמש",
  unban_user: "ביטול חסימת משתמש",
  approve_app: "אישור אפליקציה",
  reject_app: "דחיית אפליקציה",
  delete_app: "מחיקת אפליקציה",
  change_app_category: "שינוי קטגוריה לאפליקציה",
  approve_suggestion: "אישור הצעת אפליקציה",
  reject_suggestion: "דחיית הצעת אפליקציה",
  approve_pro: "אישור שדרוג PRO",
  reject_pro: "דחיית שדרוג PRO",
  approve_deletion_request: "אישור בקשת מחיקת משתמש",
  reject_deletion_request: "דחיית בקשת מחיקת משתמש",
  approve_app_report: "אישור דיווח על אפליקציה",
  reject_app_report: "דחיית דיווח על אפליקציה",
  edit_user_profile: "עריכת פרטי משתמש",
  pin_app: "נעיצת אפליקציה לראש העמוד",
  unpin_app: "ביטול נעיצת אפליקציה",
  grant_size_override: "מתן הרשאת גודל חריגה",
  revoke_size_override: "ביטול הרשאת גודל חריגה",
  grant_unlimited_public_upload: "מתן הרשאת העלאה ציבורית ללא הגבלה",
  revoke_unlimited_public_upload: "ביטול הרשאת העלאה ציבורית ללא הגבלה",
  reply_ban_appeal: "מענה לערעור חסימה",
  release_referral: "שחרור ידני של הפניה",
  revoke_referral: "ביטול תגמול הפניה",
  edit_site_rules: "עריכת חוקי האתר",
  publish_site_rules_update: "פרסום עדכון לחוקי האתר",
  hide_site_review: "הסתרת ביקורת על האתר",
  unhide_site_review: "הצגת ביקורת על האתר",
  delete_site_review: "מחיקת ביקורת על האתר",
  delete_app_review: "מחיקת תגובה על אפליקציה",
  hide_forum_post: "הסתרת פוסט בפורום",
  unhide_forum_post: "הצגת פוסט בפורום",
  delete_forum_post: "מחיקת פוסט בפורום",
  pin_forum_post: "נעיצת פוסט בפורום",
  unpin_forum_post: "ביטול נעיצת פוסט בפורום",
  forum_ban_user: "חסימת משתמש מהפורום",
  forum_unban_user: "ביטול חסימת משתמש מהפורום",
  bot_block_user: "חסימת בוט אוטומטית (ניסיון מניפולציה)"
};

interface AuditItem {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  meta: Record<string, unknown>;
  undoable: boolean;
  undone_at: string | null;
  created_at: string;
  actor?: { username: string };
}

// לוג הביקורת: כל פעולה שצוות הפיקוח (או המנהל) ביצע - מי עשה אותה, על מה/מי, ומתי.
//   • טאב "מעקב פיקוח" בפאנל הניהול - עם כפתור "ביטול פעולה" לפעולות נתמכות (מנהל בפועל).
//   • טאב "מעקב צוותים" בפאנל הפיקוח - readOnly=true, אותו תוכן בדיוק ללא אפשרות ביטול.
export default function AuditLogPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/audit-log");
    const json = await res.json().catch(() => ({ items: [] }));
    setItems(json.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function undo(id: string) {
    if (!confirm("לבטל את הפעולה הזו?")) return;
    setUndoingId(id);
    const res = await fetch(`/api/admin/audit-log/${id}/undo`, { method: "POST" });
    const json = await res.json().catch(() => null);
    setUndoingId(null);
    if (!res.ok) {
      alert(json?.error ?? "הביטול נכשל");
      return;
    }
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> טוען לוג ביקורת...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-12 text-center text-gray-500">
        <History className="h-8 w-8 text-accent" />
        עדיין לא נרשמו פעולות בלוג הביקורת.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="card flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">
              {ACTION_LABELS[item.action] ?? item.action}
              {item.target_label ? <span className="text-gray-400"> — {item.target_label}</span> : null}
            </p>
            <p className="text-xs text-gray-500">
              ע"י <span className="text-gray-300">{item.actor?.username ?? "לא ידוע"}</span> ·{" "}
              {new Date(item.created_at).toLocaleString("he-IL")}
              {item.undone_at && <span className="text-red-400"> · בוטלה</span>}
            </p>
          </div>
          {!readOnly && item.undoable && !item.undone_at && (
            <button
              onClick={() => undo(item.id)}
              disabled={undoingId === item.id}
              className="btn-ghost shrink-0 text-xs"
            >
              {undoingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
              ביטול פעולה
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
