"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck, Crown, Loader2, ShieldOff, UserCog, Trash2, Paperclip, Pencil, ThumbsUp, MessageSquare, Star } from "lucide-react";
import type { Profile } from "@/types/database";

const ROLE_LABEL: Record<string, string> = { user: "משתמש", developer: "מפתח", admin: "מנהל", moderator: "פיקוח" };

// isAdmin - מגיע מהשרת לפי הפרופיל האמיתי של הצופה (profile.role === "admin"), ולא לפי
// איזה עמוד הוא צופה בו. משפיע על: מחיקת משתמש (ישירה למנהל, בקשה בלבד לצוות פיקוח)
// ועל האפשרות להעניק/לשלול הרשאת שליחת קבצים מצוות פיקוח.
export default function UserManagementTable({ profiles, isAdmin = false }: { profiles: Profile[]; isAdmin?: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בביצוע הפעולה");
    }
  }

  // חסימת משתמש - מבקשים סיבה (מוצגת למשתמש עצמו בעמוד /banned) ומשך זמן בשעות (ריק =
  // חסימה לצמיתות). זה נשלח כ-banReason/banHours ל-API, שכבר תומך בהם (ראו
  // app/api/admin/users/[id]/route.ts) - עד עכשיו הטופס כאן פשוט לא איפשר להזין אותם.
  async function banUser(id: string, username: string) {
    const reason = window.prompt(`סיבת החסימה של "${username}" (תוצג למשתמש עצמו):`);
    if (reason === null) return;
    const hoursInput = window.prompt('משך החסימה בשעות (ריק = לצמיתות)?\nלדוגמה: 24 ליום אחד, 168 לשבוע', "");
    if (hoursInput === null) return;
    const trimmedHours = hoursInput.trim();
    if (trimmedHours && (!Number.isFinite(Number(trimmedHours)) || Number(trimmedHours) <= 0)) {
      alert("משך החסימה חייב להיות מספר חיובי של שעות, או ריק לצמיתות");
      return;
    }
    await act(id, "ban", { banReason: reason.trim() || null, banHours: trimmedHours ? Number(trimmedHours) : undefined });
  }

  async function deleteUser(id: string, username: string) {
    const first = window.confirm(
      `למחוק לגמרי את המשתמש "${username}"?\n\nפעולה זו תמחק אותו מכל מקום באתר - כולל כל האפליקציות/תוכנות שהעלה, קבצים, מוניטין, פניות תמיכה, בקשות PRO וחשבון ההתחברות. הפעולה בלתי הפיכה!`
    );
    if (!first) return;
    const typed = window.prompt(`כדי לאשר סופית, הקלידו את שם המשתמש "${username}" במדויק:`);
    if (typed !== username) {
      if (typed !== null) alert("השם שהוקלד לא תואם - המחיקה בוטלה");
      return;
    }

    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה במחיקת המשתמש");
    }
  }

  // עריכת שם משתמש - מנהל בפועל בלבד. הצגת prompt פשוט במקום טופס נפרד, כי זה שדה יחיד.
  async function editUsername(id: string, currentUsername: string) {
    const next = window.prompt("שם משתמש חדש:", currentUsername);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentUsername) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit_profile", username: trimmed })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בעדכון שם המשתמש");
    }
  }

  // צוות פיקוח לא יכול למחוק ישירות - הכפתור מגיש בקשת מחיקה שממתינה לאישור מנהל.
  async function requestDeleteUser(id: string, username: string) {
    const ok = window.confirm(`לשלוח בקשה למנהל למחיקת המשתמש "${username}"? המשתמש לא יימחק עד שהמנהל יאשר.`);
    if (!ok) return;
    const reason = window.prompt("סיבה לבקשת המחיקה (אופציונלי):") ?? "";

    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}/request-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    setBusyId(null);
    if (res.ok) {
      alert("בקשת המחיקה נשלחה לאישור מנהל.");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בשליחת בקשת המחיקה");
    }
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-right text-xs text-gray-500">
            <th className="px-4 py-3">משתמש</th>
            <th className="px-4 py-3">תפקיד</th>
            <th className="px-4 py-3">מוניטין</th>
            <th className="px-4 py-3">סטטוס</th>
            <th className="px-4 py-3">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-surface2/50">
              <td className="px-4 py-3">
                <div className="font-bold text-white">{p.username}</div>
                <div className="text-xs text-gray-500">{p.email}</div>
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-bold text-gray-300">{ROLE_LABEL[p.role]}</span>
                {p.is_pro && <span className="ms-1 rounded-full bg-gold/15 px-2 py-1 text-xs font-bold text-gold">PRO</span>}
                {p.is_moderator && <span className="ms-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-bold text-primary-light">פיקוח</span>}
                {p.is_moderator && p.can_send_attachments && (
                  <span className="ms-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-bold text-accent">הרשאת קבצים</span>
                )}
                {p.can_like_override && <span className="ms-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-bold text-accent">לייק ידני</span>}
                {p.can_comment_override && <span className="ms-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-bold text-accent">תגובה ידנית</span>}
              </td>
              {/* מוניטין (נקודות) - מוצג באופן בולט וברור, כדי שיהיה קל לראות מיד כמה יש למשתמש
                  בלי לחפש עמודה קטנה. גם צובע בזהב אם המשתמש כבר עבר את סף ה-PRO (300). */}
              <td className="px-4 py-3">
                <div className={`flex items-center gap-1 text-base font-black ${p.points >= 300 ? "text-gold" : "text-white"}`}>
                  <Star className="h-4 w-4" /> {p.points.toLocaleString("he-IL")}
                </div>
              </td>
              <td className="px-4 py-3">
                {p.banned ? (
                  <div>
                    <span className="text-xs font-bold text-red-400">חסום</span>
                    {p.ban_reason && <div className="mt-0.5 max-w-[160px] text-xs text-gray-500">{p.ban_reason}</div>}
                    <div className="mt-0.5 text-xs text-gray-600">{p.ban_expires_at ? `עד ${new Date(p.ban_expires_at).toLocaleString("he-IL")}` : "לצמיתות"}</div>
                  </div>
                ) : (
                  <span className="text-xs text-accent">פעיל</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {busyId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <>
                      {isAdmin && (
                        <button title="עריכת שם משתמש" onClick={() => editUsername(p.id, p.username)} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface2 hover:text-white"><Pencil className="h-4 w-4" /></button>
                      )}
                      {/* חשבון מנהל בפועל מוגן מחסימה לגמרי (גם בשרת וגם כאן) - אין טעם להציג
                          כפתור שתמיד ייכשל, וזה בדיוק סוג הבאג שכבר תוקן פעם אחת. */}
                      {p.role !== "admin" && (
                        p.banned ? (
                          <button title="הסרת חסימה" onClick={() => act(p.id, "unban")} className="rounded-lg p-1.5 text-accent hover:bg-accent/10"><ShieldCheck className="h-4 w-4" /></button>
                        ) : (
                          <button title="חסימת משתמש" onClick={() => banUser(p.id, p.username)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Ban className="h-4 w-4" /></button>
                        )
                      )}
                      {isAdmin && p.is_moderator && (
                        <button
                          title={p.can_send_attachments ? "שלילת הרשאת שליחת קבצים" : "מתן הרשאת שליחת קבצים בהודעות"}
                          onClick={() => act(p.id, p.can_send_attachments ? "revoke_attachments" : "grant_attachments")}
                          className={`rounded-lg p-1.5 hover:bg-surface2 ${p.can_send_attachments ? "text-accent" : "text-gray-400"}`}
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                      )}
                      {/* מתן/שלילה ידניים של הרשאת לייק/תגובה למשתמש ספציפי, גם בלי שהגיע לסף
                          האפליקציות הרגיל (מנהל/פיקוח/PRO כבר מקבלים את זה אוטומטית ממילא). */}
                      {isAdmin && (
                        <button
                          title={p.can_like_override ? "שלילת הרשאת לייק ידנית" : "מתן הרשאת לייק ידנית (גם בלי מספיק אפליקציות)"}
                          onClick={() => act(p.id, p.can_like_override ? "revoke_like" : "grant_like")}
                          className={`rounded-lg p-1.5 hover:bg-surface2 ${p.can_like_override ? "text-accent" : "text-gray-400"}`}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          title={p.can_comment_override ? "שלילת הרשאת תגובה ידנית" : "מתן הרשאת תגובה ידנית (גם בלי מספיק אפליקציות)"}
                          onClick={() => act(p.id, p.can_comment_override ? "revoke_comment" : "grant_comment")}
                          className={`rounded-lg p-1.5 hover:bg-surface2 ${p.can_comment_override ? "text-accent" : "text-gray-400"}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      )}
                      {isAdmin && (
                        p.is_moderator ? (
                          <button title="הסרה מצוות פיקוח" onClick={() => act(p.id, "demote_moderator")} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface2"><ShieldOff className="h-4 w-4" /></button>
                        ) : p.role !== "admin" ? (
                          <button title="מינוי לצוות פיקוח" onClick={() => act(p.id, "promote_moderator")} className="rounded-lg p-1.5 text-primary-light hover:bg-primary/10"><UserCog className="h-4 w-4" /></button>
                        ) : null
                      )}
                      {isAdmin && p.role === "developer" && (
                        p.is_pro ? (
                          <button title="הסרת PRO" onClick={() => act(p.id, "remove_pro")} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface2"><Crown className="h-4 w-4" /></button>
                        ) : (
                          <button title="הפיכה למפתח PRO" onClick={() => act(p.id, "make_pro")} className="rounded-lg p-1.5 text-gold hover:bg-gold/10"><Crown className="h-4 w-4" /></button>
                        )
                      )}
                      {p.role !== "admin" && (
                        isAdmin ? (
                          <button title="מחיקה מוחלטת של המשתמש" onClick={() => deleteUser(p.id, p.username)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                        ) : (
                          <button title="בקשת מחיקת משתמש (דורש אישור מנהל)" onClick={() => requestDeleteUser(p.id, p.username)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                        )
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
