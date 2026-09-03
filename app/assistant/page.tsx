import { redirect } from "next/navigation";
import Link from "next/link";
import { Bot } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { getBotConfig, botIsLive } from "@/lib/bot";
import AssistantClient from "@/components/AssistantClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "עוזר AI" };

export default async function AssistantPage() {
  const { user } = await getCurrentProfile();
  if (!user) redirect("/login?redirect=/assistant");

  const cfg = await getBotConfig();

  if (!botIsLive(cfg)) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface2 text-gray-500">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">העוזר אינו זמין כרגע</h1>
          <p className="text-sm text-gray-400">הצ'אט-בוט של עוגן פליי כבוי כרגע. אפשר לפנות לצוות דרך <Link href="/support" className="text-primary-light hover:underline">עמוד התמיכה</Link>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black">עוזר עוגן פליי</h1>
        <p className="text-sm text-gray-400">שאלו על האתר, על מוניטין ו-PRO, או בקשו שאמצא לכם אפליקציה מהמאגר לפי דרישות.</p>
      </div>
      <AssistantClient />
    </div>
  );
}
