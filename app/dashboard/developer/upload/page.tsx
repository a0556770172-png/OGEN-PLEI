"use client";
import { Suspense } from "react";
import AppUploadForm from "@/components/AppUploadForm";

// מונע רינדור סטטי בזמן ה-build (ראו הסבר מפורט ב-app/login/page.tsx)
export const dynamic = "force-dynamic";

// עוטפים ב-Suspense כי useSearchParams (מילוי מראש מהעוזר החכם - ?name=&cat=&...) דורש זאת.
export default function UploadAppPage() {
  return (
    <Suspense fallback={null}>
      <AppUploadForm />
    </Suspense>
  );
}
