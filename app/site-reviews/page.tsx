import { User as UserIcon, Star, Crown, ShieldCheck, Package, MessageSquareQuote } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { getSiteReviews, getMySiteReview } from "@/lib/siteReviews";
import SiteReviewForm from "@/components/SiteReviewForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "דירוגים וחוות דעת",
  description: "מה המשתמשים חושבים על עוגן פליי - דירוגים, חוות דעת, והשפעה על העתיד של האתר."
};

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${value >= n ? "fill-gold text-gold" : value >= n - 0.5 ? "fill-gold/50 text-gold" : "text-gray-600"}`} />
      ))}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d < 1) return "היום";
  if (d === 1) return "אתמול";
  if (d < 30) return `לפני ${d} ימים`;
  if (d < 365) return `לפני ${Math.floor(d / 30)} חודשים`;
  return new Date(dateStr).toLocaleDateString("he-IL");
}

export default async function SiteReviewsPage() {
  const [{ user }, data] = await Promise.all([getCurrentProfile(), getSiteReviews()]);
  const myReview = user ? await getMySiteReview(user.id) : null;

  const maxBar = Math.max(1, ...Object.values(data.distribution));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary shadow-glow">
          <MessageSquareQuote className="h-7 w-7 text-[#fff]" />
        </div>
        <h1 className="text-4xl font-black">דירוגים וחוות דעת</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-400">
          מה הקהילה חושבת על עוגן פליי — והמקום שלכם להשפיע על מה שיהיה כאן.
        </p>
      </section>

      {/* סיכום דירוגים בסגנון חנות אפליקציות */}
      <section className="card grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="flex flex-col items-center justify-center gap-1 border-b border-border pb-5 sm:border-b-0 sm:border-e sm:pb-0 sm:pe-8">
          <span className="text-5xl font-black text-white">{data.count ? data.avg.toLocaleString("he-IL") : "—"}</span>
          <Stars value={data.avg} size="h-5 w-5" />
          <span className="text-xs text-gray-500">{data.count.toLocaleString("he-IL")} דירוגים</span>
        </div>
        <div className="flex flex-col justify-center gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = data.distribution[n as 1 | 2 | 3 | 4 | 5] ?? 0;
            return (
              <div key={n} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-3 text-gray-400">{n}</span>
                <Star className="h-3 w-3 shrink-0 fill-gold/70 text-gold/70" />
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${(c / maxBar) * 100}%` }} />
                </span>
                <span className="w-8 text-left tabular-nums">{c}</span>
              </div>
            );
          })}
        </div>
      </section>

      <SiteReviewForm loggedIn={!!user} initial={myReview} />

      {/* הרשימה */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">מה כותבים ({data.reviews.filter((r) => r.comment).length})</h2>
        {data.reviews.filter((r) => r.comment).length === 0 ? (
          <div className="card p-8 text-center text-gray-500">עדיין אין חוות דעת כתובות. היו הראשונים!</div>
        ) : (
          data.reviews
            .filter((r) => r.comment)
            .map((r) => (
              <div key={r.id} className="card flex gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt={r.username} className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-4 w-4 text-primary-light" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-bold text-white">{r.username}</span>
                    {r.role === "admin" && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">מנהל</span>}
                    {(r.role === "developer" || r.role === "admin") && <Package className="h-3 w-3 text-accent" />}
                    {r.isPro && <Crown className="h-3 w-3 text-gold" />}
                    <span className="text-xs text-gray-600">· {timeAgo(r.created_at)}</span>
                  </div>
                  <Stars value={r.rating} />
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{r.comment}</p>
                </div>
              </div>
            ))
        )}
      </section>
    </div>
  );
}
