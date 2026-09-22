import Link from "next/link";
import { Lock, Database, Cookie, Share2, ShieldCheck, Trash2, Baby, RefreshCcw, MessageSquareText } from "lucide-react";

export const metadata = { title: "מדיניות פרטיות — עוגן פליי" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <Lock className="h-7 w-7 text-[#fff]" />
        </div>
        <h1 className="text-4xl font-black">מדיניות פרטיות</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
          עוגן פליי מכבדת את פרטיותכם. כאן מוסבר בשקיפות אילו נתונים נאספים באתר, לשם מה, ואיך אפשר
          לשלוט בהם - בלי ניסוחים משפטיים מעורפלים.
        </p>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><Database className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">אילו נתונים אנחנו אוספים</h2>
        </div>
        <ul className="flex flex-col gap-3 text-sm text-gray-400">
          <li>
            <span className="font-bold text-white">פרטי חשבון:</span> כתובת מייל, שם משתמש וסיסמה (הסיסמה
            מוצפנת ולא נגישה לנו כטקסט גלוי - הניהול נעשה דרך מערכת האימות של Supabase).
          </li>
          <li>
            <span className="font-bold text-white">תוכן שאתם מעלים או כותבים:</span> אפליקציות ותוכנות
            שהעליתם, תמונת פרופיל, ביקורות ודירוגים, הודעות צ'אט, פוסטים ותגובות בפורום, הצעות אפליקציות.
          </li>
          <li>
            <span className="font-bold text-white">כתובת IP:</span> נשמרת אך ורק לצורך מניעת ניצול לרעה
            של מערכת ההפניות (הזמנת חברים) - כדי לזהות הרשמות כפולות מאותה רשת שמנסות לזכות בתגמול
            באופן מלאכותי. לא משמשת למעקב כללי אחריכם.
          </li>
          <li>
            <span className="font-bold text-white">התראות דחיפה (Push):</span> אם אישרתם קבלת התראות
            בדפדפן, נשמר "מנוי" טכני (subscription token) שמאפשר לשלוח לכם התראה - ניתן לבטל בכל עת
            דרך הגדרות הדפדפן או הפרופיל.
          </li>
          <li>
            <span className="font-bold text-white">התראות מייל:</span> אם הפעלתם בפרופיל את האפשרות
            לקבל עדכונים במייל, נשלח אליכם דייג'סט תמציתי דרך שירות שליחת מייל חיצוני (Resend) - ניתן
            לכבות בכל רגע מאותו מקום שבו הפעלתם.
          </li>
          <li>
            <span className="font-bold text-white">נתוני שימוש אנונימיים:</span> אנחנו סופרים צפיות
            כלליות באתר לצורך סטטיסטיקה (למשל בעמוד הבית), אך זהו מונה מצטבר בלבד ואינו משויך לזהות
            המשתמש הספציפי.
          </li>
        </ul>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent"><Cookie className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">עוגיות (Cookies) ואחסון מקומי</h2>
        </div>
        <p className="text-sm text-gray-400">
          האתר משתמש ב-cookies טכניים הנחוצים לשמירת החיבור שלכם (session, דרך Supabase Auth), וב-
          localStorage בדפדפן לשמירת העדפות תצוגה (מצב כהה/בהיר, צבע ערכת נושא) - נתונים אלו נשארים
          במכשיר שלכם בלבד ולא נשלחים אלינו.
        </p>
        <p className="mt-3 text-sm text-gray-400">
          בנוסף, האתר מציג פרסומות דרך Google AdSense, ששימוש בה כרוך בהצבת עוגיות פרסום מטעם גוגל
          לצורך התאמת מודעות. תוכלו לקרוא איך גוגל משתמשת בנתונים ולנהל את העדפות הפרסום שלכם דרך{" "}
          <a
            href="https://adssettings.google.com/"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary-light hover:underline"
          >
            הגדרות המודעות של גוגל
          </a>
          .
        </p>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold"><Share2 className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">שיתוף נתונים עם צד שלישי</h2>
        </div>
        <p className="text-sm text-gray-400">
          אנחנו לא מוכרים ולא סוחרים בנתונים שלכם. הנתונים נגישים אך ורק לספקי השירות הטכניים
          שמפעילים בפועל את האתר עבורנו:
        </p>
        <ul className="mt-3 flex list-inside list-disc flex-col gap-1.5 text-sm text-gray-400">
          <li>Supabase - אחסון בסיס הנתונים וניהול ההתחברות.</li>
          <li>Cloudflare R2 - אחסון קבצים (אפליקציות, תוכנות, תמונות, צרופות).</li>
          <li>Resend - שליחת מיילים טכניים והתראות שבחרתם לקבל.</li>
          <li>Google AdSense - הצגת פרסומות באתר.</li>
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><Trash2 className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">מחיקת חשבון ונתונים</h3>
          <p className="text-sm text-gray-400">
            תרצו למחוק את החשבון והנתונים שלכם? פנו דרך{" "}
            <Link href="/support" className="text-primary-light hover:underline">עמוד התמיכה</Link> ונטפל
            בבקשה בהקדם.
          </p>
        </div>
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent"><Baby className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">קטינים</h3>
          <p className="text-sm text-gray-400">
            האתר אינו מיועד לילדים מתחת לגיל 13 ללא פיקוח הורים. אם נודע לנו על חשבון כזה, נפעל להסרתו.
          </p>
        </div>
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold"><ShieldCheck className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">אבטחת מידע</h3>
          <p className="text-sm text-gray-400">
            הגישה למידע מוגבלת לפי הרשאות (משתמש/מפתח/פיקוח/מנהל), ופעולות רגישות מתועדות ביומן
            ביקורת פנימי.
          </p>
        </div>
        <div className="card flex flex-col gap-2 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><RefreshCcw className="h-4 w-4" /></div>
          <h3 className="font-bold text-white">עדכונים למדיניות</h3>
          <p className="text-sm text-gray-400">
            מדיניות זו עשויה להתעדכן מעת לעת בהתאם לשינויים באתר. שינויים מהותיים יצוינו כאן.
          </p>
        </div>
      </section>

      <section className="card p-8 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-black">שאלות על פרטיות?</h2>
        <p className="mt-2 text-sm text-gray-400">
          פנו אלינו בכל עת דרך <Link href="/support" className="text-primary-light hover:underline">עמוד התמיכה</Link>,
          נשמח לעזור.
        </p>
      </section>
    </div>
  );
}
