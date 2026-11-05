import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MessageSquare, ChevronRight, ChevronLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import { getForumThread } from "@/lib/forum";
import { createAdminSupabase } from "@/lib/supabase/admin";
import ForumComposer from "@/components/ForumComposer";
import ForumPostCard from "@/components/ForumPostCard";
import NotifyButton from "@/components/NotifyButton";
import EmailNotifyToggle from "@/components/EmailNotifyToggle";

export const dynamic = "force-dynamic";

// עימוד תגובות: 30 בכל עמוד. ?page=N לעמוד מסוים, ?post=<id> לעמוד שבו נמצאת תגובה מסוימת (קישורים ישירים והתראות).
function Pager({ threadId, page, pages }: { threadId: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const nums = new Set<number>([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
  const list = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const href = (p: number) => (p === 1 ? `/forum/${threadId}` : `/forum/${threadId}?page=${p}`);
  const cls = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold transition";
  const items: React.ReactNode[] = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) items.push(<span key={`gap-${n}`} className="px-1 text-gray-600">…</span>);
    items.push(
      n === page ? (
        <span key={n} className={`${cls} bg-primary text-[#fff]`}>{n}</span>
      ) : (
        <Link key={n} href={href(n)} prefetch={false} className={`${cls} bg-surface2 text-gray-300 hover:text-white`}>{n}</Link>
      )
    );
  });
  return (
    <nav aria-label="עמודי תגובות" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} prefetch={false} className={`${cls} gap-1 bg-surface2 text-gray-300 hover:text-white`}>
          <ChevronRight className="h-3.5 w-3.5" /> הקודם
        </Link>
      )}
      {items}
      {page < pages && (
        <Link href={href(page + 1)} prefetch={false} className={`${cls} gap-1 bg-surface2 text-gray-300 hover:text-white`}>
          הבא <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      )}
    </nav>
  );
}

export default async function ForumThreadPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { page?: string; post?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  const staff = profile ? isStaff(profile) : false;

  const data = await getForumThread(params.id, user?.id ?? null, staff, {
    page: parseInt(searchParams.page ?? "", 10) || 1,
    focusPost: searchParams.post ?? null
  });
  if (!data) notFound();
  const { post, replies, total, page, pages } = data;

  let followsThread = false;
  if (user) {
    const { count } = await createAdminSupabase()
      .from("notification_subscriptions")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("type", "forum_thread")
      .eq("target_id", post.id);
    followsThread = (count ?? 0) > 0;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/forum" className="inline-flex items-center gap-1 text-sm text-gray-400 transition hover:text-white">
          <ArrowRight className="h-4 w-4" /> חזרה לפורום
        </Link>
        {user && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <NotifyButton
              type="forum_thread"
              targetId={post.id}
              label="עקבו אחרי הדיון"
              activeLabel="עוקבים אחרי הדיון"
              subscribed={followsThread}
              size="sm"
            />
            <EmailNotifyToggle size="sm" />
          </div>
        )}
      </div>

      <ForumPostCard post={post} loggedIn={!!user} isStaff={staff} variant="detail" />

      <div className="flex items-center gap-2 px-1 pt-2 text-sm font-bold text-gray-300">
        <MessageSquare className="h-4 w-4" /> {total.toLocaleString("he-IL")} תגובות
        {pages > 1 && <span className="text-xs font-normal text-gray-500">· עמוד {page} מתוך {pages}</span>}
      </div>

      <Pager threadId={post.id} page={page} pages={pages} />

      {replies.length > 0 && (
        <div className="flex flex-col gap-3">
          {replies.map((r) => (
            <ForumPostCard key={r.id} post={r} loggedIn={!!user} isStaff={staff} variant="reply" />
          ))}
        </div>
      )}

      <Pager threadId={post.id} page={page} pages={pages} />

      <ForumComposer parentId={post.id} loggedIn={!!user} variant="reply" />
    </div>
  );
}
