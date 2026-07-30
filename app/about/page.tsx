import { ShieldCheck, Users, Layers, Star, Crown, UploadCloud, Download, Gift } from "lucide-react";

export const metadata = { title: "אודות — עוגן פליי" };

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <ShieldCheck className="h-7 w-7 text-[#fff]" />
        </div>
        <h1 className="text-4xl font-black">אודות עוגן פליי</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
          עוגן פליי היא פלטפורמה חרדית - מאגר של אפליקציות ותוכנות מאושרות להורדה, שעברו בדיקה ידנית
          מראש ועומדות בסטנדרט הצניעות המקובל, כך שניתן להוריד אותן דרך סינוני הרשת השונים ללא צורך
          בבדיקה נוספת בזמן ההורדה עצמה.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex flex-col items-center gap-2 p-6 text-center">
          <ShieldCheck className="h-6 w-6 text-accent" />
          <h3 className="font-bold text-white">מאושר מראש</h3>
          <p className="text-sm text-gray-400">כל אפליקציה ותוכנה עוברת בדיקה ידנית ומוקפדת לפני שהיא מתפרסמת בחנות.</p>
        </div>
        <div className="card flex flex-col items-center gap-2 p-6 text-center">
          <Users className="h-6 w-6 text-primary-light" />
          <h3 className="font-bold text-white">מאגר קהילתי</h3>
          <p className="text-sm text-gray-400">כל אחד יכול לתרום למאגר - הן דרך פיתוח והן דרך הצעת אפליקציות ותוכנות פופולריות.</p>
        </div>
        <div className="card flex flex-col items-center gap-2 p-6 text-center">
          <Layers className="h-6 w-6 text-gold" />
          <h3 className="font-bold text-white">מאגר מפתחים מתעדכן</h3>
          <p className="text-sm text-gray-400">מפתחים יכולים לעדכן גרסאות לאפליקציות ולתוכנות שלהם באופן שוטף, כל עדכון נבדק מחדש.</p>
        </div>
      </section>

      <section className="card p-8">
        <h2 className="mb-4 text-2xl font-black">איך צוברים נקודות?</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><UploadCloud className="h-4 w-4" /></div>
            <div>
              <p className="font-bold text-white">העלאת אפליקציה או תוכנה חדשה — 5 נקודות</p>
              <p className="text-sm text-gray-400">כל אפליקציה או תוכנה חדשה שמפתח מעלה ונשמרת בהצלחה מזכה ב-5 נקודות.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Download className="h-4 w-4" /></div>
            <div>
              <p className="font-bold text-white">כל הורדה של אפליקציה או תוכנה שלכם — 2 נקודות</p>
              <p className="text-sm text-gray-400">ככל שיותר משתמשים מורידים את האפליקציות והתוכנות שלכם, כך אתם צוברים יותר נקודות.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold"><Gift className="h-4 w-4" /></div>
            <div>
              <p className="font-bold text-white">הצעת אפליקציה או תוכנה פופולרית שאושרה — 5 נקודות</p>
              <p className="text-sm text-gray-400">כל משתמש (גם ללא חשבון מפתח) יכול להציע אפליקציה או תוכנה למאגר. אישור ההצעה מזכה ב-5 נקודות.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold"><Crown className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">מה מקבלים בחשבון PRO?</h2>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-gray-300">
          <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-gold" /> עד 50 אפליקציות/תוכנות פעילות (במקום 5 בחשבון רגיל)</li>
          <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-gold" /> עד 100MB לקובץ (במקום 30MB בחשבון רגיל)</li>
        </ul>
        <p className="mt-4 text-sm text-gray-400">
          מגיעים ל-PRO בשתי דרכים: בקשת שדרוג ואישור מנהל, או צבירה עצמאית של 300 נקודות (מכל מקור
          יחד) - ואז השדרוג ניתן אוטומטית.
        </p>
      </section>
    </div>
  );
}
