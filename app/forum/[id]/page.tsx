import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MessageSquare } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import { getForumThread } from "@/lib/forum";
import { createAdminSupabase } from "@/lib/supabase/admin";
import ForumComposer from "@/components/ForumComposer";
import ForumPostCard from "@/components/ForumPostCard";
import NotifyButton from "@/components/NotifyButton";

export const dynamic = "force-dynamic";

export default async function ForumThreadPage({ params }: { params: { id: string } }) {
  const { user, profile } = await getCurrentProfile();
  const staff = profile ? isStaff(profile) : false;

  const data = await getForumThread(params.id, user?.id ?? null, staff);
  if (!data) notFound();
  const { post, replies } = data;

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
          <NotifyButton
            type="forum_thread"
            targetId={post.id}
            label="עקבו אחרי הדיון"
            activeLabel="עוקבים אחרי הדיון"
            subscribed={followsThread}
            size="sm"
          />
        )}
      </div>

      <ForumPostCard post={post} loggedIn={!!user} isStaff={staff} variant="detail" />

      <div className="flex items-center gap-2 px-1 pt-2 text-sm font-bold text-gray-300">
        <MessageSquare className="h-4 w-4" /> {replies.length.toLocaleString("he-IL")} תגובות
      </div>

      {replies.length > 0 && (
        <div className="flex flex-col gap-3">
          {replies.map((r) => (
            <ForumPostCard key={r.id} post={r} loggedIn={!!user} isStaff={staff} variant="reply" />
          ))}
        </div>
      )}

      <ForumComposer parentId={post.id} loggedIn={!!user} variant="reply" />
    </div>
  );
}
