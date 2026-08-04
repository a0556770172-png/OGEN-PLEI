import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import ModeratorAgreementGate from "@/components/ModeratorAgreementGate";
import SiteRulesGate from "@/components/SiteRulesGate";
import SiteVisitTracker from "@/components/SiteVisitTracker";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["300","400","500","700","900"], variable: "--font-heebo" });

// כתובת האתר בפרודקשן - יש להגדיר את NEXT_PUBLIC_SITE_URL במשתני הסביבה ב-Vercel
// (Settings -> Environment Variables) לכתובת האמיתית (למשל https://ogen-plei-qype.vercel.app
// או דומיין מותאם אישית אם יש), אחרת הקישורים בתגי ה-SEO יצביעו בטעות ל-localhost.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ogen-plei-qype.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "עוגן פליי — מאגר ו חנות אפליקציות ותוכנות",
    template: "%s | עוגן פליי"
  },
  description:
    "עוגן פליי - מאגר וחנות אפליקציות ותוכנות מחשב מאובטחת ומוקפדת לציבור החרדי. כל אפליקציה ותוכנה עוברת בדיקה ידנית לפני פרסום. הורידו, פרסמו, וגלו אפליקציות ותוכנות איכותיות בחינם.",
  keywords: [
    "עוגן פליי",
    "עוגן",
    "מאגר אפליקציות",
    "חנות אפליקציות",
    "אפליקציות לחרדים",
    "תוכנות לחרדים",
    "הורדת אפליקציות",
    "אפליקציות מאובטחות",
    "Ogen Play"
  ],
  applicationName: "עוגן פליי",
  authors: [{ name: "עוגן פליי" }],
  generator: "Next.js",
  verification: {
    // אימות בעלות באתר לגוגל סרץ' קונסול - בנוסף לקובץ ה-HTML שהועלה ל-public/,
    // מתג meta זה משמש כשיטת אימות גיבוי חלופית (google-site-verification).
    google: "0ac1856404bd19a0"
  },
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "עוגן פליי",
    title: "עוגן פליי — מאגר וחנות אפליקציות ותוכנות",
    description:
      "מאגר וחנות אפליקציות ותוכנות מחשב מאובטחת ומוקפדת לציבור החרדי. כל אפליקציה עוברת בדיקה ידנית לפני פרסום.",
    url: SITE_URL,
    images: [{ url: "/logo-512.png", width: 512, height: 512, alt: "עוגן פליי" }]
  },
  twitter: {
    card: "summary",
    title: "עוגן פליי — מאגר וחנות אפליקציות ותוכנות",
    description: "מאגר וחנות אפליקציות ותוכנות מחשב מאובטחת ומוקפדת לציבור החרדי.",
    images: ["/logo-512.png"]
  },
  alternates: {
    canonical: SITE_URL
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // נתונים מובנים (JSON-LD) כדי שגוגל יבין שמדובר באתר/מאגר אפליקציות בשם "עוגן פליי",
  // ויוכל להציג תוצאת חיפוש עשירה יותר (Sitelinks Search Box וכו') כשמחפשים את שם האתר.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "עוגן פליי",
        alternateName: ["Ogen Play", "עוגן", "מאגר אפליקציות עוגן פליי"],
        url: SITE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "Organization",
        name: "עוגן פליי",
        url: SITE_URL,
        logo: `${SITE_URL}/logo-512.png`
      }
    ]
  };

  return (
    <html lang="he" dir="rtl" className="dark">
      <head>
        {/* סקריפט חוסם קטן: קורא את בחירת המצב הכהה/בהיר שנשמרה מביקור קודם ומחיל אותה
            *לפני* הרינדור הראשון של הדף, כדי למנוע הבהוב של מצב שגוי (FOUC) ברגע הטעינה. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('ogen-theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}`
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className={`${heebo.variable} font-sans bg-bg text-gray-100 min-h-screen antialiased relative`}>
        <AnimatedBackground />
        <SiteVisitTracker />
        <SiteRulesGate />
        <ModeratorAgreementGate />
        <Navbar />
        <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="relative z-10 border-t border-border/60 py-8 text-center text-sm text-gray-500">
          כל הזכויות שמורות © עוגן פליי {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
