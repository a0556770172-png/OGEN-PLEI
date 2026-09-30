"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Home } from "lucide-react";

const REDIRECT_SECONDS = 5;

// מסך הצלחה אחרי העלאת אפליקציה (פרטית - dashboard/developer/upload, או הוספה ציבורית למאגר -
// suggest-app): מבהיר שהאפליקציה הועלתה ונשלחה לבדיקה, וחוזר אוטומטית לדף הבית.
export default function UploadSuccess({ kind, note }: { kind: "private" | "public"; note?: string }) {
  const router = useRouter();
  const [left, setLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (left <= 0) {
      router.push("/");
      router.refresh();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, router]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="flex flex-col items-center gap-3 py-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent"
      >
        <CheckCircle2 className="h-9 w-9" />
      </motion.div>
      <h2 className="text-2xl font-black text-white">
        {kind === "private" ? "האפליקציה הועלתה בהצלחה!" : "ההצעה נשלחה בהצלחה!"}
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-gray-300">
        {kind === "private"
          ? "היא נשלחה לבדיקה ידנית של צוות הפיקוח. ברגע שתאושר היא תתפרסם בחנות, ותקבלו על כך התראה."
          : "היא נשלחה לבדיקה של צוות הפיקוח. ברגע שתאושר היא תתפרסם בחנות ותקבלו מוניטין."}
      </p>
      {note && <p className="max-w-md text-xs text-gold">{note}</p>}
      <p className="text-xs text-gray-500">
        {left > 0 ? `חוזרים לדף הבית בעוד ${left} שניות...` : "חוזרים לדף הבית..."}
      </p>
      <button
        onClick={() => {
          router.push("/");
          router.refresh();
        }}
        className="btn-primary mt-1"
      >
        <Home className="h-4 w-4" /> לדף הבית עכשיו
      </button>
    </motion.div>
  );
}
