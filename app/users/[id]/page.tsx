import Link from "next/link";
import { notFound } from "next/navigation";
import { User as UserIcon, ShieldCheck, Crown, Package, Calendar, Clock } from "lucide-react";
import { getPublicUserDetail } from "@/lib/users-data";
import { getIconUrl } from "@/lib/apps-data";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

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

export default async function PublicUserPage({ params }: { params: { id: string } }) {
  const user = await getPublicUserDetail(params.id);
  if (!user) notFound();

  const isDeveloper = user.role === "developer" || user.role === "admin";
  const appsWithIcons = await Promise.all(
    user.apps.map(async (app) => ({ app, iconUrl: await getIconUrl(app.icon_key) }))
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-2 ring-border">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.username} className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-10 w-10 text-primary-light" />
          )}
        </div>
        <h1 className="text-2xl font-black text-white">{user.username}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {user.role === "admin" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">מנהל</span>
          )}
          {user.is_moderator && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary-light"><ShieldCheck className="h-3.5 w-3.5" /> צוות פיקוח</span>
          )}
          {isDeveloper && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent"><Package className="h-3.5 w-3.5" /> מפתח</span>
          )}
          {user.is_pro && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold"><Crown className="h-3.5 w-3.5" /> PRO</span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> הצטרפ/ה ב-{new Date(user.createdAt).toLocaleDateString("he-IL")}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {timeAgoLabel(user.lastSeenAt)}</span>
        </div>
      </div>

      {isDeveloper && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">אפליקציות ותוכנות שפורסמו ({appsWithIcons.length})</h2>
          {appsWithIcons.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">עדיין לא פורסמו אפליקציות או תוכנות מהמפתח הזה.</div>
          ) : (
            appsWithIcons.map(({ app, iconUrl }) => (
              <Link key={app.id} href={`/apps/${app.id}`} className="card flex items-center gap-4 p-4 transition hover:ring-1 hover:ring-primary/40">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface2 ring-1 ring-border">
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrl} alt={app.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-primary-light" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-white">{app.name}</p>
                    <StatusBadge status={app.status} />
                  </div>
                  <p className="text-xs text-gray-500">גרסה {app.version} · {app.downloads_count.toLocaleString("he-IL")} הורדות</p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
