import sharp from "sharp";

// פרסומת בגיף מונפש "קפאה" על הפריים הראשון אצל משתמשים: מסנני תוכן (כמו נטפרי) ושירותי
// אופטימיזציית תמונות בדרך מגישים לעיתים רק את הפריים הראשון של GIF. הפתרון: בשמירת הפרסומת
// הופכים את הגיף לתמונה סטטית אחת (sprite sheet) שמכילה את כל הפריימים בגריד, והדפדפן מריץ
// את האנימציה בעצמו (components/AdImage.tsx). תמונה סטטית עוברת כל מסנן כמו שהיא.
//
// נתוני האנימציה נשמרים בתוך שם הקובץ עצמו (במקום בעמודה חדשה בטבלה), כך שלא נדרשת מיגרציה.

export interface AdAnimation {
  frames: number;
  cols: number;
  width: number;
  height: number;
  frameMs: number;
}

const KEY_RE = /__anim_(\d+)f_(\d+)c_(\d+)x(\d+)_(\d+)ms\.webp$/;
const MAX_FRAME_WIDTH = 480;
const MAX_FRAMES = 60;
const MAX_SHEET_SIDE = 16000; // מגבלת WebP היא 16383 פיקסלים לצלע

export function parseAnimKey(key: string | null | undefined): AdAnimation | null {
  const m = key?.match(KEY_RE);
  if (!m) return null;
  const [frames, cols, width, height, frameMs] = m.slice(1).map(Number);
  if (!frames || !cols || !width || !height || !frameMs) return null;
  return { frames, cols, width, height, frameMs };
}

export function animKeyFor(sourceKey: string, a: AdAnimation): string {
  return `${sourceKey}__anim_${a.frames}f_${a.cols}c_${a.width}x${a.height}_${a.frameMs}ms.webp`;
}

// מחזיר null אם התמונה אינה מונפשת (תמונה רגילה מוצגת כמו שהיא).
export async function buildAdSprite(input: Buffer): Promise<{ sprite: Buffer; anim: AdAnimation } | null> {
  const meta = await sharp(input, { animated: true }).metadata();
  const pages = meta.pages ?? 1;
  if (pages < 2 || !meta.width || !meta.pageHeight) return null;

  // בגיף ארוך מדלגים על פריימים באופן שווה ומאריכים את זמן ההצגה בהתאם, כדי שהקצב הכולל יישמר.
  const step = Math.ceil(pages / MAX_FRAMES);
  const indices: number[] = [];
  for (let i = 0; i < pages; i += step) indices.push(i);
  const frames = indices.length;

  // דפדפנים מציגים השהיה של פחות מ-20ms כ-100ms - מחקים את אותה התנהגות.
  const delays = (meta.delay ?? []).map((d) => (d && d >= 20 ? d : 100));
  const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 100;
  const frameMs = Math.max(20, Math.round(avgDelay * step));

  const cols = Math.ceil(Math.sqrt(frames));
  const rows = Math.ceil(frames / cols);
  let width = Math.min(meta.width, MAX_FRAME_WIDTH);
  width = Math.min(width, Math.floor(MAX_SHEET_SIDE / cols));
  let height = Math.max(1, Math.round((meta.pageHeight * width) / meta.width));
  if (height * rows > MAX_SHEET_SIDE) {
    height = Math.floor(MAX_SHEET_SIDE / rows);
    width = Math.max(1, Math.round((meta.width * height) / meta.pageHeight));
  }

  const tiles = await Promise.all(
    indices.map(async (page, i) => ({
      input: await sharp(input, { page, pages: 1 }).resize(width, height, { fit: "fill" }).png().toBuffer(),
      left: (i % cols) * width,
      top: Math.floor(i / cols) * height
    }))
  );

  const sprite = await sharp({
    create: { width: cols * width, height: rows * height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(tiles)
    .webp({ quality: 82 })
    .toBuffer();

  return { sprite, anim: { frames, cols, width, height, frameMs } };
}
