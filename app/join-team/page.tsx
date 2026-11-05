import Link from "next/link";
import { ShieldCheck, LogIn, Clock, XCircle, CheckCircle2, Lock, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/profile";
import { isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isTeamRecruitOpen } from "@/lib/team";
import { TEAM_COOLDOWN_DAYS } from "@/lib/teamQuestions";
import TeamApplyForm from "@/components/TeamApplyForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "הצטרפות לצוות הפיקוח",
  description: "רוצה להצטרף לצוות הפיקוח של עוגן פליי? ממלאים שאלון קצר, והצוות חוזר אליכם.",
  robots: { index: false }
};

function Notice({ icon: Icon, title, text, tone = "text-primary-light", children }: { icon: typeof Lock; title: string; text: string; tone?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <Icon className={`h-10 w-10 ${tone}`} />
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="max-w-md text-sm text-gray-400">{text}</p>
      {children}
    </div>
  );
}

export default async function JoinTeamPage({ searchParams }: { searchParams: { preview?: string } }) {
  const [{ user, profile }, open] = await Promise.all([getCurrentProfile(), isTeamRecruitOpen()]);

  let body: React.ReactNode;
  if (!open) {
    body = <Notice icon={Lock} title="הגיוס סגור כרגע" text="כרגע לא מתקבלות מועמדויות חדשות לצוות הפיקוח. נפתח שוב בהמשך - כדאי לבדוק מדי פעם." />;
  } else if (!user || !profile) {
    body = (
      <Notice icon={LogIn} title="צריך להתחבר כדי להגיש מועמדות" text="המועמדות נקשרת לחשבון שלך באתר, כדי שנוכל לחזור אליך.">
        <Link href="/login?redirect=/join-team" className="btn-primary">התחברות</Link>
        <Link href="/signup/user" className="text-xs text-gray-400 hover:text-white hover:underline">אין חשבון? הרשמה</Link>
      </Notice>
    );
  } else if (isStaff(profile) && searchParams.preview === "1" && profile.role === "admin") {
    // תצוגה מקדימה למנהל: רואים את השאלון כמו שהמועמד רואה אותו (השליחה תידחה כי אתה כבר בצוות)
    body = (
      <>
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-center text-sm text-gold">
          תצוגה מקדימה למנהל - אפשר למלא ולראות, אבל שליחה לא תתקבל כי אתה כבר חלק מהצוות.
        </div>
        <TeamApplyForm />
      </>
    );
  } else if (isStaff(profile)) {
    body = <Notice icon={ShieldCheck} title="אתה כבר חלק מהצוות" text="תודה על העשייה! אין צורך להגיש מועמדות." tone="text-accent" />;
  } else {
    const { data: last } = await createAdminSupabase()
      .from("team_applications")
      .select("status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last && last.status !== "rejected") {
      const text =
        last.status === "approved"
          ? "המועמדות שלך אושרה! הצוות ייצור איתך קשר עם הפרטים."
          : last.status === "interview"
            ? "המועמדות שלך התקדמה - הצוות יפנה אליך בקרוב לשיחה."
            : "המועמדות שלך התקבלה והצוות עובר עליה. תקבל התראה באתר כשיהיה עדכון.";
      body = (
        <Notice
          icon={last.status === "approved" ? CheckCircle2 : Clock}
          title={last.status === "approved" ? "המועמדות אושרה" : "המועמדות שלך בטיפול"}
          text={text}
          tone={last.status === "approved" ? "text-accent" : "text-gold"}
        />
      );
    } else if (last && (Date.now() - new Date(last.created_at).getTime()) / 86_400_000 < TEAM_COOLDOWN_DAYS) {
      body = (
        <Notice
          icon={XCircle}
          title="המועמדות הקודמת לא התקבלה"
          text={`תודה על ההתעניינות. אפשר להגיש מועמדות חדשה אחרי ${TEAM_COOLDOWN_DAYS} ימים מהבקשה הקודמת.`}
          tone="text-gray-400"
        />
      );
    } else {
      body = <TeamApplyForm />;
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary shadow-glow">
          <Users className="h-7 w-7 text-[#fff]" />
        </div>
        <h1 className="text-3xl font-black">הצטרפות לצוות הפיקוח</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-400">
          צוות הפיקוח שומר שהאתר יישאר נקי, מסודר ומתאים לכולם: בודק אפליקציות ותוכנות, עונה לפניות ומטפל בפורום. הפיקוח הוא
          התנדבותי ודורש אחריות ופעילות קבועה. ממלאים שאלון קצר, ואנחנו נחזור אליכם.
        </p>
      </section>
      {body}
    </div>
  );
}
