import Link from "next/link";
import { Users, Rocket, Package, Crown, ShieldCheck, User as UserIcon } from "lucide-react";
import { getUsersStats, getPublicUsersList } from "@/lib/users-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "משתמשים — עוגן פליי" };

function timeAgoLabel(dateStr: string | null) {
  if (!dateStr) return "מעולם לא";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 5) return "מחובר עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString("he-IL");
}

export default async function UsersDirectoryPage() {
  const [{ totalUsers, totalDevelopers }, users] = await Promise.all([getUsersStats(), getPublicUsersList()]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <Users className="h-6 w-6 text-[#fff]" />
        </div>
        <h1 className="text-3xl font-black">משתמשי הקהילה</h1>
        <p className="mx-auto mt-2 max-w-lg text-gray-400">כל חברי הקהילה והמפתחים שמרכיבים את עוגן פליי.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><Users className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">סה"כ משתמשים</p>
            <p className="text-xl font-black">{totalUsers.toLocaleString("he-IL")}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent"><Rocket className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">מתוכם מפתחים</p>
            <p className="text-xl font-black">{totalDevelopers.toLocaleString("he-IL")}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <Link
            key={u.id}
            href={`/users/${u.id}`}
            className="card flex items-center gap-4 p-4 transition hover:ring-1 hover:ring-primary/40"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatarUrl} alt={u.username} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-5 w-5 text-primary-light" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-white">{u.username}</p>
                {u.role === "admin" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">מנהל</span>
                )}
                {u.is_moderator && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary-light"><ShieldCheck className="h-3 w-3" /> פיקוח</span>
                )}
                {(u.role === "developer" || u.role === "admin") && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent"><Package className="h-3 w-3" /> מפתח · {u.appsCount} אפליקציות/תוכנות</span>
                )}
                {u.is_pro && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold"><Crown className="h-3 w-3" /> PRO</span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                הצטרפ/ה ב-{new Date(u.createdAt).toLocaleDateString("he-IL")} · {timeAgoLabel(u.lastSeenAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
