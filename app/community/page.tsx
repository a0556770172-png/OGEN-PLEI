import CommunityBoard from "@/components/CommunityBoard";
import NotifyButton from "@/components/NotifyButton";
import { getCurrentProfile } from "@/lib/profile";
import { getCategoriesServer } from "@/lib/categories";
import { isStaff } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "בקשות קהילתיות",
  description: "לוח בקשות קהילתי - בקשו אפליקציה או תוכנה, ומתנדבים יורידו ויעלו אותה עבורכם."
};

export default async function CommunityPage() {
  const [{ user, profile }, categories] = await Promise.all([
    getCurrentProfile(),
    getCategoriesServer()
  ]);

  return (
    <div className="flex flex-col gap-4">
      {user && (
        <div className="flex justify-center sm:justify-end">
          <NotifyButton type="community" label="קבל התראה על בקשת קהילה חדשה" size="sm" />
        </div>
      )}
      <CommunityBoard
        currentUserId={user?.id ?? null}
        isStaffUser={profile ? isStaff(profile) : false}
        categories={categories}
      />
    </div>
  );
}
