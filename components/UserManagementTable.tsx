"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck, Crown, Loader2, ShieldOff, UserCog, Trash2 } from "lucide-react";
import type { Profile } from "@/types/database";

const ROLE_LABEL: Record<string, string> = { user: "משתמש", developer: "מפתח", admin: "מנהל", moderator: "פיקוח" };

export default function UserManagementTable({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בביצוע הפעולה");
    }
  }

  async function deleteUser(id: string, username: string) {
    const first = window.confirm(
      `למחוק לגמרי את המשתמש "${username}"?\n\nפעולה זו תמחק אותו מכל מקום באתר - כולל כל האפליקציות/תוכנות שהעלה, קבצים, נקודות, פניות תמיכה, בקשות PRO וחשבון ההתחברות. הפעולה בלתי הפיכה!`
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

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-right text-xs text-gray-500">
            <th className="px-4 py-3">משתמש</th>
            <th className="px-4 py-3">תפקיד</th>
            <th className="px-4 py-3">נקודות</th>
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
              </td>
              <td className="px-4 py-3">{p.points.toLocaleString("he-IL")}</td>
              <td className="px-4 py-3">
                {p.banned ? <span className="text-xs font-bold text-red-400">חסום</span> : <span className="text-xs text-accent">פעיל</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {busyId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <>
                      {p.banned ? (
                        <button title="הסרת חסימה" onClick={() => act(p.id, "unban")} className="rounded-lg p-1.5 text-accent hover:bg-accent/10"><ShieldCheck className="h-4 w-4" /></button>
                      ) : (
                        <button title="חסימת משתמש" onClick={() => act(p.id, "ban")} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Ban className="h-4 w-4" /></button>
                      )}
                      {p.is_moderator ? (
                        <button title="הסרה מצוות פיקוח" onClick={() => act(p.id, "demote_moderator")} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface2"><ShieldOff className="h-4 w-4" /></button>
                      ) : p.role !== "admin" ? (
                        <button title="מינוי לצוות פיקוח" onClick={() => act(p.id, "promote_moderator")} className="rounded-lg p-1.5 text-primary-light hover:bg-primary/10"><UserCog className="h-4 w-4" /></button>
                      ) : null}
                      {p.role === "developer" && (
                        p.is_pro ? (
                          <button title="הסרת PRO" onClick={() => act(p.id, "remove_pro")} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface2"><Crown className="h-4 w-4" /></button>
                        ) : (
                          <button title="הפיכה למפתח PRO" onClick={() => act(p.id, "make_pro")} className="rounded-lg p-1.5 text-gold hover:bg-gold/10"><Crown className="h-4 w-4" /></button>
                        )
                      )}
                      {p.role !== "admin" && (
                        <button title="מחיקה מוחלטת של המשתמש" onClick={() => deleteUser(p.id, p.username)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
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
