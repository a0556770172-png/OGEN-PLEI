import sanitizeHtml from "sanitize-html";

// מנקה HTML שמגיע ממשתמשים (תיאורי אפליקציות וכו') לפני שמירה במסד הנתונים - חוסם XSS
// אחסוני (למשל <img onerror=...> או <script>) שהיה יכול לרוץ בדפדפן של כל מי שצופה בעמוד.
// רשימת התגיות/מאפיינים מותרת בכוונה צרה - תואמת בדיוק למה שעורך הטקסט (RichTextEditor)
// באמת מייצר (הדגשה, רשימות, קישורים), ולא יותר מזה.
export function sanitizeUserHtml(html: string): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "a", "div", "span"],
    allowedAttributes: {
      a: ["href", "target", "rel"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" })
    }
  });
}
