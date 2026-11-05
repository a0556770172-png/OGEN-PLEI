"use client";
import { useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { TEAM_QUESTIONS, type TeamQuestion } from "@/lib/teamQuestions";

// טופס שאלון הקבלה לצוות הפיקוח. השאלות והאימות מגיעים מ-lib/teamQuestions.ts (אותו מקור גם בשרת).
export default function TeamApplyForm() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  function clientCheck(): string | null {
    for (const q of TEAM_QUESTIONS) {
      const v = (answers[q.id] ?? "").trim();
      if (!v) {
        if (q.required) return `חובה לענות: ${q.label}`;
        continue;
      }
      if (q.type === "number") {
        const n = Number(v);
        if (!Number.isFinite(n) || n < (q.min ?? 0) || n > (q.max ?? 999)) return `ערך לא תקין: ${q.label}`;
      } else if (q.type !== "select" && q.min && v.length < q.min) {
        return `התשובה קצרה מדי (לפחות ${q.min} תווים): ${q.label}`;
      }
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = clientCheck();
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/team/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בשליחה");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "שגיאה בשליחה");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-accent" />
        <h2 className="text-2xl font-black text-white">המועמדות נשלחה!</h2>
        <p className="max-w-md text-sm text-gray-400">
          תודה שהקדשת זמן. הצוות יעבור על התשובות ויחזור אליך דרך האתר (תקבל התראה). בינתיים אפשר להמשיך כרגיל.
        </p>
      </div>
    );
  }

  const sections: { title: string; questions: TeamQuestion[] }[] = [];
  for (const q of TEAM_QUESTIONS) {
    const last = sections[sections.length - 1];
    if (last && last.title === q.section) last.questions.push(q);
    else sections.push({ title: q.section, questions: [q] });
  }

  let n = 0;
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {sections.map((s) => (
        <section key={s.title} className="card flex flex-col gap-5 p-5 sm:p-6">
          <h2 className="text-lg font-black text-white">{s.title}</h2>
          {s.questions.map((q) => {
            n++;
            const value = answers[q.id] ?? "";
            return (
              <div key={q.id}>
                <label htmlFor={`q-${q.id}`} className="mb-1.5 block text-sm font-bold text-gray-200">
                  {n}. {q.label} {q.required ? <span className="text-gold">*</span> : <span className="text-xs font-normal text-gray-500">(לא חובה)</span>}
                </label>
                {q.hint && <p className="mb-1.5 text-xs text-gray-500">{q.hint}</p>}
                {q.type === "select" ? (
                  <div className="flex flex-col gap-1.5">
                    {q.options!.map((opt) => (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                          value === opt ? "border-primary/60 bg-primary/10 text-white" : "border-white/10 bg-surface2/50 text-gray-300 hover:border-primary/30"
                        }`}
                      >
                        <input type="radio" name={q.id} checked={value === opt} onChange={() => set(q.id, opt)} className="h-4 w-4 shrink-0 accent-primary" />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : q.type === "textarea" ? (
                  <>
                    <textarea
                      id={`q-${q.id}`}
                      value={value}
                      onChange={(e) => set(q.id, e.target.value)}
                      rows={4}
                      maxLength={q.max}
                      className="input-field w-full resize-y"
                    />
                    {q.max && <p className="mt-1 text-left text-[11px] text-gray-600" dir="ltr">{value.length}/{q.max}</p>}
                  </>
                ) : (
                  <input
                    id={`q-${q.id}`}
                    type={q.type === "number" ? "number" : "text"}
                    inputMode={q.type === "number" ? "numeric" : undefined}
                    min={q.type === "number" ? q.min : undefined}
                    max={q.type === "number" ? q.max : undefined}
                    value={value}
                    onChange={(e) => set(q.id, e.target.value)}
                    maxLength={q.type === "text" ? q.max : undefined}
                    placeholder={q.placeholder}
                    className="input-field w-full"
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}

      <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base sm:w-auto sm:self-start">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        שליחת מועמדות
      </button>
    </form>
  );
}
