import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getAvatarUrl } from "@/lib/avatar";
import { createServerSupabase } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/constants";
import Link from "next/link";
import { Rocket, MessageSquareText, History, Star } from "lucide-react";
import AvatarUploadForm from "@/components/AvatarUploadForm";
import DeveloperAppsPanel from "@/components/DeveloperAppsPanel";
import ProfileTagsEditor from "@/components/ProfileTagsEditor";
import { getDeveloperContributionCount, isDmUnlocked, DM_UNLOCK_THRESHOLD } from "@/lib/dm-eligibility";
import type { AppRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");

  const avatarUrl = await getAvatarUrl(profile.avatar_key, profile.role);

  // מנהל יכול גם הוא לפעול כמפתח (להעלות אפליקציות בעצמו), בדיוק כמו מפתח רגיל
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
  const dmUnlocked = await isDmUnlocked(user.id);
  const dmUnlockedByRole = profile.role === "admin" || profile.is_moderator || profile.is_pro;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black">הפרופיל שלי</h1>
        <p className="text-sm text-gray-400">שלום {profile.username}, כאן תוכלו לנהל את הפרטים שלכם{isDeveloper ? " ואת האפליקציות שלכם" : ""}.</p>
      </div>

      {/* "ג'וקר" - תג ויזואלי שמוצג רק למי שקיבל מהמנהל הרשאת גודל חד-פעמית (ראו טאב "הרשאות
          גודל" בניהול). המטרה: שהמשתמש עצמו ידע בבירור שיש לו את זה פעיל, ומה בדיוק מותר לו,
          לפני שהוא ניגש להעלות אפליקציה/תוכנה או להציע הצעה ציבורית. */}
      {profile.size_override_mb && (
        <div className="card mx-auto flex w-full max-w-xl items-center gap-4 border border-gold/40 bg-gold/5 p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Star className="h-5 w-5 fill-gold" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gold">יש לך ג'וקר! 🃏</p>
            <p className="text-sm text-gray-400">
              המנהל נתן לך אפשרות חד-פעמית להעלות אפליקציה או תוכנה אחת בגודל של עד{" "}
              <b className="text-white">{profile.size_override_mb}MB</b> - גם בהעלאה פרטית מהדשבורד וגם בהצעת
              אפליקציה ציבורית, מעבר למכסה הרגילה שלך. ברגע שתעלה קובץ שחורג מהמכסה הרגילה, הג'וקר ינוצל
              ויתבטל אוטומטית - כך שכדאי לנצל אותו על האפליקציה/התוכנה הגדולה שבאמת צריך.
            </p>
          </div>
        </div>
      )}

      <div className="card mx-auto w-full max-w-xl p-8">
        <AvatarUploadForm currentAvatarUrl={avatarUrl} username={profile.username} />
      </div>

      <div className="mx-auto w-full max-w-xl">
        <ProfileTagsEditor
          initialNotes={profile.notes}
          initialDisplayEmail={profile.display_email}
          initialShowEmailTag={profile.show_email_tag}
        />
      </div>

      <div className="card mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-white">צ'אט</p>
            {dmUnlocked ? (
              <p className="text-sm text-gray-400">
                {dmUnlockedByRole ? "פתוח לך תמיד (PRO/צוות)" : `פתוח לך! (${contributionCount} אפליקציות/הצעות שאושרו)`}
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                נפתח אוטומטית אחרי {DM_UNLOCK_THRESHOLD} אפליקציות/הצעות שאושרו (כרגע: {contributionCount}). פרטים בעמוד <Link href="/about" className="text-primary-light hover:underline">ההסברים</Link>.
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

      {profile.role === "user" && (
        <div className="card mx-auto flex w-full max-w-xl flex-col items-center gap-3 p-6 text-center">
          <Rocket className="h-8 w-8 text-primary-light" />
          <div>
            <p className="font-bold text-white">רוצה לפרסם אפליקציות ותוכנות משלך?</p>
            <p className="text-sm text-gray-400">אפשר לשדרג את החשבון שלך למפתח בכמה שניות, ישירות מכאן - זה מאפשר עריכה והעלאת גרסאות בעתיד.</p>
          </div>
          <Link href="/profile/become-developer" className="btn-primary">
            <Rocket className="h-4 w-4" /> הרשמה כמפתח
          </Link>
          <p className="text-xs text-gray-500">
            רק רוצים להציע אפליקציה של מישהו אחר (כמו Waze) שכדאי שתהיה בחנות?{" "}
            <Link href="/suggest-app" className="font-bold text-primary-light hover:underline">הוספה למאגר וצבירת מוניטין</Link>
          </p>
        </div>
      )}

      {isDeveloper && (
        <DeveloperAppsPanel
          apps={apps}
          points={profile.points}
          isPro={profile.is_pro}
          proStatus={profile.pro_status}
          proAdminMessage={proAdminMessage}
          maxApps={plan.maxApps}
          developerUsername={profile.username}
        />
      )}
    </div>
  );
}
