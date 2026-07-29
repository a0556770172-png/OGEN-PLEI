import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getAvatarUrl } from "@/lib/avatar";
import { createServerSupabase } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/constants";
import AvatarUploadForm from "@/components/AvatarUploadForm";
import DeveloperAppsPanel from "@/components/DeveloperAppsPanel";
import type { AppRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) redirect("/login");

  const avatarUrl = await getAvatarUrl(profile.avatar_key);

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black">הפרופיל שלי</h1>
        <p className="text-sm text-gray-400">שלום {profile.username}, כאן תוכלו לנהל את הפרטים שלכם{isDeveloper ? " ואת האפליקציות שלכם" : ""}.</p>
      </div>

      <div className="card mx-auto w-full max-w-xl p-8">
        <AvatarUploadForm currentAvatarUrl={avatarUrl} username={profile.username} />
      </div>

      {isDeveloper && (
        <DeveloperAppsPanel
          apps={apps}
          points={profile.points}
          isPro={profile.is_pro}
          proStatus={profile.pro_status}
          proAdminMessage={proAdminMessage}
          maxApps={plan.maxApps}
        />
      )}
    </div>
  );
}
