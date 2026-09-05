import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getAvatarUrl } from "@/lib/avatar";
import { createServerSupabase } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/constants";
import Link from "next/link";
import { Rocket, MessageSquareText, History, Star, User as UserIcon, ExternalLink, Coins } from "lucide-react";
import AvatarUploadForm from "@/components/AvatarUploadForm";
import DeveloperAppsPanel from "@/components/DeveloperAppsPanel";
import ProfileTagsEditor from "@/components/ProfileTagsEditor";
import MitmachimConnect from "@/components/MitmachimConnect";
import NotificationsManager from "@/components/NotificationsManager";
import ReferralCard from "@/components/ReferralCard";
import { getReferralStats } from "@/lib/referral";
import { getFollowCounts } from "@/lib/follows";
import { getDeveloperContributionCount, isDmUnlocked, DM_UNLOCK_THRESHOLD } from "@/lib/dm-eligibility";
import type { AppRow } from "@/types/database";

export const dynamic = "force-dynamic";

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-1">
      <h2 className="text-lg font-black text-white">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default async function ProfilePage() {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");

  const avatarUrl = await getAvatarUrl(profile.avatar_key, profile.role);
  const isDeveloper = profile.role === "developer" || profile.role === "admin";

  let apps: AppRow[] = [];
  let proAdminMessage: string | null = null;
  if (isDeveloper) {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("apps")
      .select("*")
      .eq("developer_id", user.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    apps = (data as AppRow[]) ?? [];

    const { data: lastProRequest } = await supabase
      .from("pro_requests")
      .select("admin_message")
      .eq("developer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    proAdminMessage = lastProRequest?.admin_message ?? null;
  }

  const plan = profile.is_pro ? LIMITS.pro : LIMITS.free;
  const contributionCount = await getDeveloperContributionCount(user.id);
  const referralStats = await getReferralStats(user.id);
  const followCounts = await getFollowCounts(user.id);
  const dmUnlocked = await isDmUnlocked(user.id);
  const dmUnlockedByRole = profile.role === "admin" || profile.is_moderator || profile.is_pro;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {/* ---- כותרת / זהות ---- */}
      <div className="card flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:items-center sm:text-right">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-2 ring-border">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={profile.username} className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-9 w-9 text-primary-light" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-white">{profile.username}</h1>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-gray-400 sm:justify-start">
            <span className="inline-flex items-center gap-1 text-gold">
              <Coins className="h-4 w-4" /> {(profile.points ?? 0).toLocaleString("he-IL")} מוניטין
            </span>
            <span><b className="text-white">{followCounts.followers.toLocaleString("he-IL")}</b> עוקבים</span>
            <span><b className="text-white">{followCounts.following.toLocaleString("he-IL")}</b> עוקב/ת אחרי</span>
          </div>
        </div>
        <Link
          href={`/users/${user.id}`}
          className="btn-ghost shrink-0 text-sm"
        >
          <ExternalLink className="h-4 w-4" /> הפרופיל הציבורי
        </Link>
      </div>

      {/* ---- ג'וקר (אם קיים) ---- */}
      {profile.size_override_mb && (
        <div className="card flex w-full items-center gap-4 border border-gold/40 bg-gold/5 p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Star className="h-5 w-5 fill-gold" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gold">יש לך ג'וקר! 🃏</p>
            <p className="text-sm text-gray-400">
              המנהל נתן לך אפשרות חד-פעמית להעלות אפליקציה או תוכנה אחת בגודל של עד{" "}
              <b className="text-white">{profile.size_override_mb}MB</b> - גם בהעלאה פרטית מהדשבורד וגם בהצעת
              אפליקציה ציבורית, מעבר למכסה הרגילה שלך. ברגע שתעלה קובץ שחורג מהמכסה הרגילה, הג'וקר ינוצל
              ויתבטל אוטומטית.
            </p>
          </div>
        </div>
      )}

      {/* ---- אזור מפתח ---- */}
      {isDeveloper ? (
        <section className="flex flex-col gap-3">
          <SectionHeader title="האפליקציות והתוכנות שלי" hint="ניהול, גרסאות, ומעקב מוניטין" />
          <DeveloperAppsPanel
            apps={apps}
            points={profile.points}
            isPro={profile.is_pro}
            proStatus={profile.pro_status}
            proAdminMessage={proAdminMessage}
            maxApps={plan.maxApps}
            developerUsername={profile.username}
          />
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <SectionHeader title="פרסום אפליקציות ותוכנות" />
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <Rocket className="h-8 w-8 text-primary-light" />
            <div>
              <p className="font-bold text-white">רוצה לפרסם אפליקציות ותוכנות משלך?</p>
              <p className="text-sm text-gray-400">
                אפשר לשדרג את החשבון שלך למפתח בכמה שניות, ישירות מכאן - זה מאפשר עריכה והעלאת גרסאות בעתיד.
              </p>
            </div>
            <Link href="/profile/become-developer" className="btn-primary">
              <Rocket className="h-4 w-4" /> הרשמה כמפתח
            </Link>
            <p className="text-xs text-gray-500">
              רק רוצים להציע אפליקציה של מישהו אחר (כמו Waze) שכדאי שתהיה בחנות?{" "}
              <Link href="/suggest-app" className="font-bold text-primary-light hover:underline">
                הוספה למאגר וצבירת מוניטין
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* ---- פרטים אישיים ---- */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="הפרטים שלי" hint="תמונה, תגיות, וחיבור לפרופיל מתמחים טופ - מה שאחרים רואים עליכם" />
        <div className="card w-full p-6 sm:p-8">
          <AvatarUploadForm currentAvatarUrl={avatarUrl} username={profile.username} />
        </div>
        <ProfileTagsEditor
          initialNotes={profile.notes}
          initialDisplayEmail={profile.display_email}
          initialShowEmailTag={profile.show_email_tag}
        />
        <MitmachimConnect initialUrl={profile.mitmachim_url ?? null} />
      </section>

      {/* ---- הזמנת חברים ---- */}
      <section id="referrals" className="flex scroll-mt-24 flex-col gap-3">
        <SectionHeader title="הזמנת חברים" hint="כל חבר שנרשם דרך הקישור שלכם = מוניטין וקרדיט העלאה" />
        <ReferralCard username={profile.username} stats={referralStats} />
      </section>

      {/* ---- התראות ---- */}
      <section id="notifications" className="flex scroll-mt-24 flex-col gap-3">
        <SectionHeader title="התראות" hint="עדכונים על אפליקציות, גרסאות, בקשות קהילה ועוד" />
        <NotificationsManager />
      </section>

      {/* ---- צ'אט ---- */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="צ'אט עם משתמשים" />
        <div className="card flex w-full flex-col gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              {dmUnlocked ? (
                <p className="text-sm text-gray-400">
                  {dmUnlockedByRole
                    ? "הצ'אט פתוח לך תמיד (PRO/צוות)."
                    : `הצ'אט פתוח לך! (${contributionCount} אפליקציות/הצעות שאושרו)`}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  נפתח אוטומטית אחרי {DM_UNLOCK_THRESHOLD} אפליקציות/הצעות שאושרו (כרגע: {contributionCount}). פרטים
                  בעמוד <Link href="/about" className="text-primary-light hover:underline">ההסברים</Link>.
                </p>
              )}
            </div>
          </div>
          {dmUnlocked && (
            <div className="flex flex-wrap gap-2">
              <Link href="/users" className="btn-primary text-sm">
                <MessageSquareText className="h-4 w-4" /> התחל צ'אט
              </Link>
              <Link href="/messages" className="btn-ghost text-sm">
                <History className="h-4 w-4" /> צ'אט (היסטוריה)
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
