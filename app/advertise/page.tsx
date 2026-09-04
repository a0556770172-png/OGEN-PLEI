import Link from "next/link";
import { Megaphone, Users, ShieldCheck, TrendingUp, Phone, Check, ArrowLeft } from "lucide-react";

export const metadata = { title: "פרסום באתר — עוגן פליי" };

const PLANS = [
  { months: 1, label: "חודש אחד", price: 100 },
  { months: 2, label: "חודשיים", price: 180, note: "חוסכים 20 ₪" },
  { months: 3, label: "3 חודשים", price: 200, note: "הכי משתלם", highlight: true }
];

const PHONE = "0556770172";

export default function AdvertisePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary shadow-glow">
          <Megaphone className="h-7 w-7 text-[#fff]" />
        </div>
        <h1 className="text-4xl font-black">פרסום בעוגן פליי</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
          מול אלפי משתמשים שמורידים כאן אפליקציות ותוכנות כל יום. חשיפה ממוקדת, ישירה, לקהל שכבר כאן.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex flex-col items-center gap-2 p-6 text-center">
          <Users className="h-6 w-6 text-primary-light" />
          <h3 className="font-bold text-white">קהל איכותי</h3>
          <p className="text-sm text-gray-400">משתמשים חוזרים שכבר סומכים על האתר להורדה בטוחה - קהל היעד שלכם, בדיוק כאן.</p>
        </div>
        <div className="card flex flex-col items-center gap-2 p-6 text-center">
          <ShieldCheck className="h-6 w-6 text-accent" />
          <h3 className="font-bold text-white">בקרה ואיכות</h3>
          <p className="text-sm text-gray-400">כל פרסומת עוברת אישור ידני, כדי לשמור על אותו סטנדרט אמינות של כל האתר.</p>
        </div>
        <div className="card flex flex-col items-center gap-2 p-6 text-center">
          <TrendingUp className="h-6 w-6 text-gold" />
          <h3 className="font-bold text-white">חשיפה מובטחת</h3>
          <p className="text-sm text-gray-400">הפרסומת מוצגת לכל משתמש שמוריד אפליקציה או תוכנה - חשיפה עקבית וישירה.</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-center text-2xl font-black">מחירון</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.months}
              className={`card relative flex flex-col items-center gap-3 p-6 text-center ${
                p.highlight ? "border-2 border-gold/50 bg-gradient-to-br from-gold/15 via-surface to-surface shadow-glow" : ""
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 rounded-full bg-gold px-3 py-1 text-[11px] font-black text-[#111]">
                  {p.note}
                </span>
              )}
              <p className="text-sm font-bold text-gray-400">{p.label}</p>
              <p className="text-3xl font-black text-white">
                {p.price} <span className="text-base font-bold text-gray-500">₪</span>
              </p>
              {!p.highlight && p.note && <p className="text-xs font-semibold text-accent">{p.note}</p>}
              <ul className="mt-1 flex flex-col gap-1.5 text-xs text-gray-400">
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-primary-light" /> חשיפה בכל הורדה באתר</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-primary-light" /> עיצוב הפרסומת בסיוע הצוות</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-primary-light" /> ניתן לעצור/להחליף בכל עת</li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="card flex flex-col items-center gap-4 border-2 border-primary/50 bg-gradient-to-br from-primary/15 via-surface to-surface p-8 text-center shadow-glow">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary-light">
          <Phone className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">רוצים לפרסם אצלנו?</h2>
          <p className="mt-2 max-w-md text-sm text-gray-400">
            להזמנות ולפרטים נוספים - התקשרו אלינו ישירות ונתאם הכול מהר ובקלות.
          </p>
        </div>
        <a href={`tel:${PHONE}`} dir="ltr" className="btn-primary px-8 py-3.5 text-base">
          <Phone className="h-5 w-5" /> {PHONE} <ArrowLeft className="h-5 w-5" />
        </a>
        <p className="text-xs text-gray-500">אפשר גם לפנות דרך <Link href="/support" className="text-primary-light hover:underline">עמוד התמיכה</Link> ולציין שמדובר בפנייה לפרסום.</p>
      </section>
    </div>
  );
}
