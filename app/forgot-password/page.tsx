import { KeyRound } from "lucide-react";
import ResetAssistant from "@/components/ResetAssistant";

export const dynamic = "force-dynamic";
export const metadata = { title: "שכחתי סיסמה — עוגן פליי" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-[#fff] shadow-glow">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black">שכחתי סיסמה</h1>
        <p className="text-sm text-gray-400">העוזר יעזור לך להחזיר גישה לחשבון דרך קישור איפוס במייל.</p>
      </div>
      <div className="card p-4">
        <ResetAssistant />
      </div>
    </div>
  );
}
