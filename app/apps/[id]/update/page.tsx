import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getAppById } from "@/lib/apps-data";
import { getCurrentProfile } from "@/lib/profile";
import AppUploadForm from "@/components/AppUploadForm";

export const dynamic = "force-dynamic";

// "עדכן את האפליקציה" - עמוד העלאת גרסה חדשה לאפליקציה ציבורית (כל משתמש מחובר).
export default async function UpdateAppPage({ params }: { params: { id: string } }) {
  const app = await getAppById(params.id);
  if (!app) notFound();
  if (app.status !== "approved" || app.source !== "public_suggestion") redirect(`/apps/${app.id}`);

  const { user } = await getCurrentProfile();
  if (!user) redirect(`/login?redirect=/apps/${app.id}/update`);

  return (
    <Suspense fallback={null}>
      <AppUploadForm mode="update" targetApp={app} />
    </Suspense>
  );
}
