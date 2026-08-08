import CommunityBoard from "@/components/CommunityBoard";
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
    <CommunityBoard
      currentUserId={user?.id ?? null}
      isStaffUser={profile ? isStaff(profile) : false}
      categories={categories}
    />
  );
}
