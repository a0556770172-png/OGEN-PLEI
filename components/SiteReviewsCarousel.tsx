"use client";
import { useRef, useState } from "react";
import { Star, BadgeCheck, Heart, ChevronLeft, ChevronRight, User as UserIcon, Crown, Package } from "lucide-react";
import type { SiteReviewRow } from "@/lib/siteReviews";

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL");
}

function ReviewCard({
  r,
  liked: initialLiked,
  loggedIn
}: {
  r: SiteReviewRow;
  liked: boolean;
  loggedIn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(r.likeCount);
  const [busy, setBusy] = useState(false);
  const long = (r.comment ?? "").length > 160;

  async function toggleLike() {
    if (!loggedIn || busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    const res = await fetch(`/api/site-reviews/${r.id}/like`, { method: "POST" });
    if (!res.ok) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
    setBusy(false);
  }

  return (
    <div className="flex w-[280px] shrink-0 snap-start flex-col rounded-2xl border border-border bg-surface2/70 p-4 sm:w-[320px]">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1 text-right">
          <p className="flex items-center justify-end gap-1.5 truncate font-bold text-white">
            {r.isPro && <Crown className="h-3.5 w-3.5 text-gold" />}
            {(r.role === "developer" || r.role === "admin") && <Package className="h-3.5 w-3.5 text-accent" />}
            {r.username}
          </p>
          <p className="text-xs text-gray-500">{dateLabel(r.created_at)}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface ring-1 ring-border">
          {r.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.avatarUrl} alt={r.username} className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-4 w-4 text-primary-light" />
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="inline-flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`h-4 w-4 ${r.rating >= n ? "fill-gold text-gold" : "text-gray-600"}`} />
          ))}
        </span>
        <BadgeCheck className="h-4 w-4 text-primary-light" />
      </div>

      {r.comment && (
        <p className={`mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-300 ${expanded ? "" : "line-clamp-4"}`}>
          {r.comment}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <button
          onClick={toggleLike}
          disabled={!loggedIn || busy}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold transition ${
            liked ? "text-red-400" : "text-gray-500 hover:text-gray-300"
          } ${!loggedIn ? "cursor-default" : ""}`}
          title={loggedIn ? "לייק" : "התחברו כדי לסמן לייק"}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-red-400" : ""}`} /> {count > 0 ? count : ""}
        </button>
        {r.comment && long && (
          <button onClick={() => setExpanded((e) => !e)} className="text-xs font-semibold text-gray-500 hover:text-white">
            {expanded ? "הצג פחות" : "קרא עוד"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SiteReviewsCarousel({
  reviews,
  likedIds,
  loggedIn
}: {
  reviews: SiteReviewRow[];
  likedIds: string[];
  loggedIn: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const likedSet = new Set(likedIds);
  const withComment = reviews.filter((r) => r.comment);

  if (withComment.length === 0) {
    return <div className="card p-8 text-center text-gray-500">עדיין אין חוות דעת כתובות. היו הראשונים!</div>;
  }

  function scroll(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {withComment.length > 1 && (
        <>
          <button
            onClick={() => scroll(1)}
            aria-label="הקודם"
            className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-surface p-1.5 text-gray-400 shadow-card transition hover:text-white sm:block"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(-1)}
            aria-label="הבא"
            className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-surface p-1.5 text-gray-400 shadow-card transition hover:text-white sm:block"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {withComment.map((r) => (
          <ReviewCard key={r.id} r={r} liked={likedSet.has(r.id)} loggedIn={loggedIn} />
        ))}
      </div>
    </div>
  );
}
