import Link from "next/link";
import { FileText, UserCheck, UploadCloud, Megaphone, Crown, Ban, Scale, RefreshCcw } from "lucide-react";

export const metadata = { title: "תנאי שימוש — עוגן פליי" };

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <FileText className="h-7 w-7 text-[#fff]" />
        </div>
        <h1 className="text-4xl font-black">תנאי שימוש</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
          התנאים המשפטיים לשימוש באתר עוגן פליי. לכללי ההתנהגות הקהילתיים והתוכן המותר, ראו את{" "}
          <Link href="/site-rules" className="text-primary-light hover:underline">חוקי האתר</Link>. שימוש באתר
          מהווה הסכמה לשני העמודים יחד.
        </p>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><UserCheck className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">חשבון ואחריות המשתמש</h2>
        </div>
        <ul className="flex list-inside list-disc flex-col gap-2 text-sm text-gray-400">
          <li>הפרטים שנמסרים בהרשמה (מייל, שם משתמש) צריכים להיות נכונים, והאחריות על שמירת הסיסמה חלה עליכם בלבד.</li>
          <li>אסור ליצור חשבונות כפולים כדי לעקוף מגבלות המערכת (כמות אפליקציות, מערכת ההפניות וכדומה).</li>
          <li>הנהלת האתר רשאית להשהות או לחסום חשבון שמפר תנאים אלו או את חוקי האתר, לפי שיקול דעתה.</li>
        </ul>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent"><UploadCloud className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">תוכן שמעלים לאתר</h2>
        </div>
        <p className="text-sm text-gray-400">
          כמפתח או מציע אפליקציה, אתם מצהירים שיש לכם את כל הזכויות הדרושות להפצת התוכן שהעליתם.
          הבעלות על האפליקציה/תוכנה נשארת שלכם - אתם רק מעניקים לעוגן פליי רישיון להציג, לאחסן
          ולהפיץ אותה דרך האתר, כל עוד היא מפורסמת במאגר. אתם יכולים לבקש הסרה בכל עת דרך עמוד
          התמיכה.
        </p>
        <p className="mt-3 text-sm text-gray-400">
          כל תוכן (אפליקציה, תיאור, תגובה, פוסט בפורום) עובר בקרה ידנית ועשוי להידחות או להוסר אם
          אינו עומד בקריטריונים המפורטים ב<Link href="/site-rules" className="text-primary-light hover:underline">חוקי האתר</Link>.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold"><Crown className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">תרומות ושדרוג PRO</h3>
          <p className="text-sm text-gray-400">
            תרומות דרך Ko-fi הן לטובת החזקת האתר ומקנות שדרוג PRO כמפורט ב
            <Link href="/about" className="text-primary-light hover:underline"> עמוד ההסברים</Link>.
            השדרוג ניתן ידנית ואינו אוטומטי מיידי.
          </p>
        </div>
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><Megaphone className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">פרסומות באתר</h3>
          <p className="text-sm text-gray-400">
            באתר עשויות להופיע פרסומות של מפרסמים ישירים (ראו <Link href="/advertise" className="text-primary-light hover:underline">עמוד הפרסום</Link>)
            וכן פרסומות דרך Google AdSense. תוכן פרסומות חיצוניות אינו באחריות עוגן פליי.
          </p>
        </div>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400"><Ban className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">הגבלת אחריות</h2>
        </div>
        <p className="text-sm text-gray-400">
          האפליקציות והתוכנות במאגר עוברות בדיקה ידנית לפני פרסום, אך הן מסופקות "כפי שהן" (as-is)
          וללא אחריות. עוגן פליי אינה אחראית לנזק ישיר או עקיף שייגרם משימוש באפליקציה או תוכנה
          שהורדתם. האתר עצמו מוצע "כפי שהוא", ואנו עושים מאמץ לשמור על זמינות רציפה אך לא מתחייבים
          לכך באופן מוחלט (תחזוקה, עדכונים ותקלות טכניות עלולים לגרום להפסקות זמניות).
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent"><Scale className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">דין חל</h3>
          <p className="text-sm text-gray-400">תנאים אלו כפופים לדיני מדינת ישראל.</p>
        </div>
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold"><RefreshCcw className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">עדכון תנאים</h3>
          <p className="text-sm text-gray-400">התנאים עשויים להתעדכן מעת לעת; המשך שימוש באתר מהווה הסכמה לגרסה המעודכנת.</p>
        </div>
      </section>

      <section className="card p-8 text-center">
        <h2 className="text-xl font-black">שאלות?</h2>
        <p className="mt-2 text-sm text-gray-400">
          פנו אלינו דרך <Link href="/support" className="text-primary-light hover:underline">עמוד התמיכה</Link>.
        </p>
      </section>
    </div>
  );
}
