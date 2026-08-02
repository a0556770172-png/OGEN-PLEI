import Link from "next/link";
import { ShieldCheck, Users, Layers, Star, Crown, UploadCloud, Download, Gift, MessageSquareText, LifeBuoy, ArrowLeft, Heart } from "lucide-react";

export const metadata = { title: "הסברים — עוגן פליי" };

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <ShieldCheck className="h-7 w-7 text-[#fff]" />
        </div>
        <h1 className="text-4xl font-black">הסברים</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
          עוגן פליי היא פלטפורמה חרדית - מאגר של אפליקציות ותוכנות מאושרות להורדה, שעברו בדיקה ידנית
          מראש ועומדות בסטנדרט הצניעות המקובל, כך שניתן להוריד אותן דרך סינוני הרשת השונים ללא צורך
          בבדיקה נוספת בזמן ההורדה עצמה.
        </p>
      </section>

      <section className="card flex flex-col items-center gap-4 border-2 border-primary/50 bg-gradient-to-br from-primary/15 via-surface to-surface p-8 text-center shadow-glow">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary-light">
          <LifeBuoy className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">יש לכם שאלה, בעיה, או פנייה לתמיכה?</h2>
          <p className="mt-2 max-w-md text-sm text-gray-400">כל הפניות והשיחות עם הצוות שלנו נמצאות במקום אחד - לחצו על הכפתור ותועברו לשם ישירות.</p>
        </div>
        <Link href="/support" className="btn-primary px-8 py-3.5 text-base">
          <MessageSquareText className="h-5 w-5" /> לחצו כאן לפנייה לתמיכה <ArrowLeft className="h-5 w-5" />
        </Link>
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
          יחד) - ואז השדרוג ניתן אוטומטית. שדרוג PRO אינו אוטומטי מיידי בבקשה - הפעלת המערכת
          (אחסון, תעבורה ותחזוקה) כרוכה בעלות, ולכן קיימים תנאים וקריטריונים למתן שדרוג, וכל בקשה
          נבדקת בהתאם.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-gold/40 bg-gradient-to-br from-gold/15 via-surface to-surface p-6 text-center shadow-glow">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/20 text-gold"><Heart className="h-5 w-5" /></div>
          <p className="text-lg font-black text-white">דרך שלישית, המהירה מכולן - תמיכה בפרויקט</p>
          <p className="max-w-md text-sm text-gray-300">
            מי שתורם/ת 3$ ומעלה לטובת החזקת האתר, מקבל/ת חשבון PRO ישירות - בלי קשר לכמות
            האפליקציות שהעליתם ובלי לחכות לצבירת נקודות. זו הדרך הכי פשוטה לעזור לנו להמשיך
            להחזיק את השרתים דלוקים, ולקבל בתמורה את כל היתרונות של PRO באופן מיידי.
          </p>
          <a
            href="https://ko-fi.com/aishivsheramlumad"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-primary bg-gold text-[#111] hover:bg-gold/90"
          >
            <Heart className="h-4 w-4" /> תמכו בפרויקט וקבלו PRO
          </a>
          <p className="text-xs text-gray-500">לאחר התרומה, שלחו לנו הודעה עם אישור התרומה דרך כפתור התמיכה למעלה בעמוד הזה, ונשדרג את החשבון שלכם ל-PRO בהקדם.</p>
        </div>
      </section>

      <section className="card p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><MessageSquareText className="h-4 w-4" /></div>
          <h2 className="text-2xl font-black">איך פותחים צ'אט עם משתמש אחר?</h2>
        </div>
        <p className="text-sm text-gray-400">
          יכולת פתיחת שיחה עם משתמש אחר נפתחת אוטומטית ברגע שהעליתם או הצעתם (בהצעה שאושרה) 10
          אפליקציות/תוכנות במאגר, בכל שילוב בין העלאה פרטית להצעה ציבורית - שני המקורות מצטרפים
          יחד לאותו סכום. אין צורך לבקש - ברגע שהגעתם ל-10, כפתור "פתיחת שיחה" יופיע בפרופיל
          הציבורי של משתמשים אחרים, וגם אצלכם בעמוד הפרופיל תוכלו לראות לאיזה שלב הגעתם.
        </p>
        <p className="mt-3 text-sm text-gray-400">
          חשוב לדעת: הצ'אט בין משתמשים מיועד אך ורק לצורך טכני בנושא האפליקציות והתוכנות שהמפתח
          העלה למאגר (למשל שאלות תמיכה, תיאום עדכון גרסה וכדומה) - ולא לשיחה כללית.
        </p>
      </section>

      <section className="card p-8 text-center">
        <h2 className="mb-2 text-xl font-black">יש לכם רעיון, הצעה לשיפור, או שאלה?</h2>
        <p className="text-sm text-gray-400">
          נשמח לשמוע! אפשר לכתוב בפורום בקישור הזה:{" "}
          <a
            href="https://mitmachim.top/topic/99932/%D7%A9%D7%99%D7%AA%D7%95%D7%A3-%D7%A2%D7%95%D7%92%D7%9F-%D7%A4%D7%9C%D7%99%D7%99-%D7%94%D7%A4%D7%99%D7%AA%D7%A8%D7%95%D7%9F-%D7%9C%D7%9E%D7%A4%D7%AA%D7%97%D7%99%D7%9D-%D7%91%D7%A0%D7%98%D7%A4%D7%A8%D7%99-%D7%9E%D7%90%D7%92%D7%A8-%D7%AA%D7%95%D7%9B%D7%A0%D7%95%D7%AA-%D7%95%D7%90%D7%A4%D7%9C%D7%99%D7%A7%D7%A6%D7%99%D7%95%D7%AA-%D7%9E%D7%90%D7%95%D7%A9%D7%A8%D7%95%D7%AA-%D7%91%D7%A0%D7%98%D7%A4%D7%A8%D7%99-%D7%91%D7%A4%D7%99%D7%AA%D7%95%D7%97?_=1785616963425"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary-light hover:underline"
          >
            לחצו כאן לפתיחת נושא בפורום
          </a>{" "}
          או פשוט לשלוח הודעה לצוות הניהול דרך <Link href="/support" className="text-primary-light hover:underline">כפתור הפנייה לתמיכה</Link> למעלה בעמוד הזה.
        </p>
      </section>
    </div>
  );
}
