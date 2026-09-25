// מתרגם את כל ממשק האתר לאנגלית בזמן ריצה, בצד הלקוח.
//
// למה ככה ולא i18n "רגיל" עם מפתחות: כל הטקסטים באתר כתובים ישירות בעברית בתוך ~280 קבצים,
// והמעבר למערכת מפתחות היה נוגע כמעט בכל שורה. במקום זה יש מילון מלא (lib/i18n/en.json)
// שממפה כל טקסט עברי שמופיע בקוד לתרגום אנגלי, ו-MutationObserver שמחליף כל צומת טקסט/תכונה
// שמופיעים בדף - כולל תוכן שנטען אחר כך (מודאלים, הודעות שגיאה מהשרת, ניווט בין עמודים).
// הלוגיקה של React לא מושפעת: רק ה-DOM המוצג משתנה, לא ערכי ה-state או מה שנשלח לשרת.
//
// en.json נוצר מתוך הקוד עצמו. כשמוסיפים טקסט עברי חדש לאתר, צריך להוסיף גם את התרגום שלו
// למילון - אחרת הטקסט החדש פשוט יוצג בעברית גם במצב אנגלית.

export interface EnDictionary {
  exact: Record<string, string>;
  patterns: [string, string][];
}

const HEB = /[֐-׿]/;
const TRANSLATED_ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
const SKIP_SELECTOR = '[contenteditable=""],[contenteditable="true"],[data-no-translate],.notranslate';

// תאריכים שנוצרו בשרת (toLocaleString עם he-IL) - לא מופיעים בקוד כטקסט קבוע, אז מתורגמים מילה-מילה.
// התוצאה מתקבלת רק אם לא נשארה אף אות עברית אחרי ההחלפה.
const WORDS: [RegExp, string][] = [
  [/יום ראשון/g, "Sunday"], [/יום שני/g, "Monday"], [/יום שלישי/g, "Tuesday"], [/יום רביעי/g, "Wednesday"],
  [/יום חמישי/g, "Thursday"], [/יום שישי/g, "Friday"], [/יום שבת|שבת/g, "Saturday"],
  [/יום א[׳']/g, "Sun"], [/יום ב[׳']/g, "Mon"], [/יום ג[׳']/g, "Tue"], [/יום ד[׳']/g, "Wed"],
  [/יום ה[׳']/g, "Thu"], [/יום ו[׳']/g, "Fri"],
  [/ב?ינואר/g, "January"], [/ב?פברואר/g, "February"], [/ב?מרץ/g, "March"], [/ב?אפריל/g, "April"],
  [/ב?מאי/g, "May"], [/ב?יוני/g, "June"], [/ב?יולי/g, "July"], [/ב?אוגוסט/g, "August"],
  [/ב?ספטמבר/g, "September"], [/ב?אוקטובר/g, "October"], [/ב?נובמבר/g, "November"], [/ב?דצמבר/g, "December"],
  [/בשעה/g, "at"], [/אתמול/g, "yesterday"], [/היום/g, "today"], [/עכשיו/g, "now"]
];

interface CompiledPattern {
  re: RegExp;
  order: number[];
  en: string;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createTranslator(dict: EnDictionary) {
  const exact = dict.exact;
  const patterns: CompiledPattern[] = dict.patterns.map(([he, en]) => {
    const order: number[] = [];
    const source = he
      .split(/(\{\d\})/)
      .map((part) => {
        const m = part.match(/^\{(\d)\}$/);
        if (m) {
          order.push(Number(m[1]));
          return "([\\s\\S]*?)";
        }
        return escapeRe(part);
      })
      .join("");
    return { re: new RegExp(`^${source}$`), order, en };
  });

  function translateCore(core: string): string | null {
    const direct = exact[core];
    if (direct !== undefined) return direct;

    for (const p of patterns) {
      const m = p.re.exec(core);
      if (!m) continue;
      const values: Record<number, string> = {};
      p.order.forEach((idx, i) => {
        const v = m[i + 1] ?? "";
        values[idx] = exact[v.trim()] ?? v;
      });
      return p.en.replace(/\{(\d)\}/g, (_, d) => values[Number(d)] ?? "");
    }

    let words = core;
    for (const [re, en] of WORDS) words = words.replace(re, en);
    if (!HEB.test(words)) return words;

    return null;
  }

  // מחזיר את התרגום, או null אם אין מה לתרגם (אין עברית / טקסט לא מוכר כמו תוכן של משתמשים).
  function translate(text: string): string | null {
    if (!text || !HEB.test(text)) return null;
    if (text.includes("\n")) {
      let changed = false;
      const out = text.split("\n").map((line) => {
        const t = translate(line);
        if (t !== null) changed = true;
        return t ?? line;
      });
      return changed ? out.join("\n") : null;
    }
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    const core = m[2].replace(/\s+/g, " ");
    const t = translateCore(core);
    return t === null ? null : m[1] + t + m[3];
  }

  return { translate };
}

export function startDomTranslation(dict: EnDictionary) {
  const { translate } = createTranslator(dict);
  const done = new WeakMap<Node, string>();

  function skipped(el: Element | null): boolean {
    if (!el) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    return !!el.closest(SKIP_SELECTOR);
  }

  function translateText(node: Text) {
    const current = node.nodeValue ?? "";
    if (done.get(node) === current) return;
    const parent = node.parentElement;
    if (skipped(parent)) return;
    const t = translate(current);
    if (t !== null && t !== current) {
      // <option> בלי value שולח את הטקסט שלו - שומרים את הערך העברי המקורי כדי לא לשנות את מה שנשלח.
      if (parent!.tagName === "OPTION" && !parent!.hasAttribute("value")) parent!.setAttribute("value", current.trim());
      node.nodeValue = t;
      done.set(node, t);
    } else {
      done.set(node, current);
    }
  }

  function translateAttr(el: Element, name: string) {
    if (name === "dir") {
      if (el.getAttribute("dir") === "rtl" && el !== document.documentElement) el.setAttribute("dir", "ltr");
      return;
    }
    const v = el.getAttribute(name);
    if (!v) return;
    const t = translate(v);
    if (t !== null && t !== v) el.setAttribute(name, t);
  }

  function translateElement(el: Element) {
    if (el.getAttribute("dir") === "rtl") el.setAttribute("dir", "ltr");
    if (skipped(el)) return;
    for (const a of TRANSLATED_ATTRS) if (el.hasAttribute(a)) translateAttr(el, a);
    if (el.tagName === "INPUT") {
      const type = (el as HTMLInputElement).type;
      if (type === "submit" || type === "button") translateAttr(el, "value");
    }
  }

  function walk(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    translateElement(root as Element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
      else translateElement(n as Element);
      n = walker.nextNode();
    }
  }

  walk(document.documentElement);

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "childList") r.addedNodes.forEach(walk);
      else if (r.type === "characterData") translateText(r.target as Text);
      else if (r.type === "attributes" && r.attributeName) {
        const el = r.target as Element;
        if (r.attributeName === "dir" || !skipped(el)) translateAttr(el, r.attributeName);
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRS, "value", "dir"]
  });

  // חלונות alert/confirm/prompt של הדפדפן אינם חלק מה-DOM - מתרגמים את ההודעה לפני ההצגה.
  const w = window as any;
  if (!w.__ogenDialogsPatched) {
    w.__ogenDialogsPatched = true;
    const origAlert = window.alert.bind(window);
    const origConfirm = window.confirm.bind(window);
    const origPrompt = window.prompt.bind(window);
    window.alert = (msg?: any) => origAlert(typeof msg === "string" ? translate(msg) ?? msg : msg);
    window.confirm = (msg?: string) => origConfirm(typeof msg === "string" ? translate(msg) ?? msg : msg);
    window.prompt = (msg?: string, def?: string) => origPrompt(typeof msg === "string" ? translate(msg) ?? msg : msg, def);

    // תאריכים ושעות שמעוצבים בדפדפן עם he-IL - מציגים בפורמט אנגלי.
    const toEn = (locales: any) =>
      (typeof locales === "string" && locales.startsWith("he")) || (Array.isArray(locales) && String(locales[0]).startsWith("he"))
        ? "en-GB"
        : locales;
    const proto = Date.prototype as any;
    for (const fn of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
      const orig = proto[fn];
      proto[fn] = function (this: Date, locales?: any, options?: any) {
        return orig.call(this, toEn(locales), options);
      };
    }
  }

  return () => observer.disconnect();
}
