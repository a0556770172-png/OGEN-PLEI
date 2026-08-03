import { Users, Rocket } from "lucide-react";
import { getUsersStats, getPublicUsersList } from "@/lib/users-data";
import UsersDirectoryList from "@/components/UsersDirectoryList";

export const dynamic = "force-dynamic";
export const metadata = { title: "משתמשים — עוגן פליי" };

export default async function UsersDirectoryPage() {
  const [{ totalUsers, totalDevelopers }, users] = await Promise.all([getUsersStats(), getPublicUsersList()]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <Users className="h-6 w-6 text-[#fff]" />
        </div>
        <h1 className="text-3xl font-black">משתמשי הקהילה</h1>
        <p className="mx-auto mt-2 max-w-lg text-gray-400">כל חברי הקהילה והמפתחים שמרכיבים את עוגן פליי.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><Users className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">סה"כ משתמשים</p>
            <p className="text-xl font-black">{totalUsers.toLocaleString("he-IL")}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent"><Rocket className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">מתוכם מפתחים</p>
            <p className="text-xl font-black">{totalDevelopers.toLocaleString("he-IL")}</p>
          </div>
        </div>
      </div>

      <UsersDirectoryList users={users} />
    </div>
  );
}
