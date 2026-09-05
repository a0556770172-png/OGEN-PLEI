import Link from "next/link";
import { Lightbulb, MessageSquarePlus } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import { getForumThreads, getForumStats, type ForumSort } from "@/lib/forum";
import ForumComposer from "@/components/ForumComposer";
import ForumPostCard from "@/components/ForumPostCard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "הצעות לשיפור ורעיונות — עוגן פליי",
  description: "פורום קהילתי: מה מפריע, מה חסר, ואיך אפשר לשפר ולקדם את עוגן פליי."
};

export default async function ForumPage({ searchParams }: { searchParams: { sort?: string } }) {
  const { user, profile } = await getCurrentProfile();
  const staff = profile ? isStaff(profile) : false;
  const sort: ForumSort = searchParams.sort === "top" ? "top" : "new";

  const [threads, stats] = await Promise.all([
    getForumThreads(user?.id ?? null, { sort, isStaff: staff }),
    getForumStats()
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header className="rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/10 via-surface to-surface p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary text-[#fff] shadow-glow">
          <Lightbulb className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black">הצעות לשיפור ורעיונות</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
          מה מפריע לכם? מה חסר? איך הייתם משפרים ומקדמים את עוגן פליי? כתבו, הגיבו, ותנו לייק —
          <b className="text-gold"> כל לייק לפוסט מוסיף מוניטין לכותב</b>.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          {stats.threads.toLocaleString("he-IL")} פוסטים · {stats.posters.toLocaleString("he-IL")} כותבים
        </p>
      </header>

      <ForumComposer loggedIn={!!user} />

      <div className="flex items-center gap-2">
        <Link
          href="/forum"
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            sort === "new" ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"
          }`}
        >
          החדשים
        </Link>
        <Link
          href="/forum?sort=top"
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            sort === "top" ? "bg-primary text-[#fff]" : "bg-surface2 text-gray-400 hover:text-white"
          }`}
        >
          הכי אהובים
        </Link>
      </div>

      {threads.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <MessageSquarePlus className="h-8 w-8 text-gray-600" />
          <p className="text-sm text-gray-500">עדיין אין פוסטים. תהיו הראשונים לכתוב מה הייתם משפרים!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((t) => (
            <ForumPostCard key={t.id} post={t} loggedIn={!!user} isStaff={staff} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}
