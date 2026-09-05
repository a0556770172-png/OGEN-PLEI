import NotificationsFeed from "@/components/NotificationsFeed";

export const metadata = { title: "ההתראות שלי — עוגן פליי" };

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-black">ההתראות שלי</h1>
      <NotificationsFeed />
    </div>
  );
}
